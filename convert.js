import { simplifyExpression } from "./simplify.js";

function collect(objects, propName) {
  return objects.reduce((prev, curr) => {
    return !(propName in curr) ||
      prev.some((v) => JSON.stringify(v) === JSON.stringify(curr[propName]))
      ? prev
      : [...prev, curr[propName]];
  }, []);
}

function analyzeStyle(mbStyle) {
  const layers = mbStyle.layers;
  const sources = mbStyle.sources;
  const sourceLayers = collect(layers, "source-layer");
  const layerTypes = collect(layers, "type");

  const filters = collect(layers, "filter");
  const zoomLevels = new Array(22).fill(0).map((v, i) => i + 1);

  console.log(
    `Sources: ${Object.keys(mbStyle.sources)
      .map((s) => `${s} (${sources[s].type})`)
      .join(", ")}`
  );
  console.log(`Source layers: ${sourceLayers.length}`);
  console.log(`Source layers count: ${sourceLayers.join(", ")}`);
  console.log(`Layers count: ${layers.length}`);
  layerTypes.forEach((type) =>
    console.log(
      `- of type ${type}: ${layers.filter((l) => l.type === type).length}`
    )
  );
  console.log(
    `Layers not visible count: ${
      layers.filter((l) => l?.layout?.visibility !== "visible").length
    }`
  );
  console.log(`Unique filters count: ${filters.length}`);
  console.log(
    `Total filters count: ${layers.filter((l) => !!l.filter).length}`
  );
  console.log("Layers visible by zoom level:");
  zoomLevels.forEach((level) =>
    console.log(
      `  ${level}: ${
        layers.filter((l) => l.maxzoom >= level && l.minzoom <= level).length
      }`
    )
  );
}

function fixExpression(expression) {
  if (!Array.isArray(expression)) return expression;
  if (expression[0] === "all" && expression.length === 2) {
    return fixExpression(expression[1]);
  }
  if (expression[0] === "get" && expression[1] === "$type") {
    return ["geometry-type"];
  }
  if (expression[0] === "==") {
    let compared = expression[1];
    if (typeof compared === "string") compared = ["get", expression[1]];
    return [
      expression[0],
      fixExpression(compared),
      ...expression.slice(2).map(fixExpression),
    ];
  }
  if (expression[0] === "interpolate") {
    return [
      expression[0],
      expression[1],
      ...expression.slice(2).map(fixExpression),
    ];
  }
  return [expression[0], ...expression.slice(1).map(fixExpression)];
}

/**
 * @param {string} layer
 * @param {Object} spritesheet
 * @param {string} spritesPath
 * @return {Object}
 */
function getStyleForSourceLayer(layer, spritesheet, spritesPath) {
  const filters = [["==", ["get", "layer"], layer["source-layer"]]];
  if (layer.filter) {
    filters.push(fixExpression(layer.filter));
  }
  // convert zoom to web mercator resolution
  if (layer.maxzoom) {
    filters.push([
      ">",
      ["resolution"],
      156543.03392804097 / Math.pow(2, layer.maxzoom),
    ]);
  }
  if (layer.minzoom) {
    filters.push([
      "<",
      ["resolution"],
      156543.03392804097 / Math.pow(2, layer.minzoom),
    ]);
  }

  const style = {};
  const props = { ...layer.paint, ...layer.layout };
  for (const prop in props) {
    const value = fixExpression(props[prop]);
    switch (prop) {
      case "fill-outline-color":
        style["stroke-color"] = value;
        style["stroke-width"] = style["stroke-width"] || 1;
        break;
      case "fill-color":
        style["fill-color"] = value;
        break;
      case "fill-pattern": {
        const spriteInfo = spritesheet[value];
        style["fill-pattern-src"] = spritesPath;
        style["fill-pattern-offset"] = [spriteInfo.x, spriteInfo.y];
        style["fill-pattern-size"] = [spriteInfo.width, spriteInfo.height];
        style["fill-pattern-scale"] = 64 / spriteInfo.width;
        break;
      }
      case "line-color":
        style["stroke-color"] = value;
        break;
      case "line-width":
        style["stroke-width"] = value;
        break;
      case "line-cap":
        style["stroke-line-cap"] = value;
        break;
      case "line-join":
        style["stroke-line-join"] = value;
        break;
      case "line-offset":
        style["stroke-offset"] = ["/", value, 2]; // FIXME: width in OL shaders is doubled! this is a bug
        break;
      case "icon-image": {
        const spriteInfo = spritesheet[value];
        if (props["symbol-placement"] === "point") {
          style["icon-src"] = spritesPath;
          style["icon-offset"] = [spriteInfo.x, spriteInfo.y];
          style["icon-size"] = [spriteInfo.width, spriteInfo.height];
          style["icon-scale"] = fixExpression(props["icon-size"]);
        } else if (props["symbol-placement"] === "line") {
          style["stroke-pattern-src"] = spritesPath;
          style["stroke-pattern-offset"] = [spriteInfo.x, spriteInfo.y];
          style["stroke-pattern-size"] = [spriteInfo.width, spriteInfo.height];
          style["stroke-width"] = [
            "*",
            fixExpression(props["icon-size"]),
            spriteInfo.height * 0.5,
          ];
        }
        break;
      }
      case "symbol-spacing":
        style["stroke-pattern-spacing"] = ["*", 0.5, value];
        break;
    }
  }

  return {
    filter: filters.length === 1 ? filters[0] : ["all", ...filters],
    ...style,
  };

  // const layers = mbStyle.layers
  //   .filter((l) => l["source-layer"] === sourceLayer)
  //   .filter((l) => l?.layout?.visibility === "visible");
  // const filters = collect(layers, "filter");
  // const filter = filters.length
  //   ? simplifyExpression(["any", ...filters])
  //   : undefined;
  // if (!layers[0]) {
  //   return { filter };
  // }
  // return {
  //   filter,
  //   ...layers[0].paint,
  //   ...layers[0].layout,
  // };
}

// /**
//  * @param {Object} mbStyle JSON style
//  */
// export function convertToFlatStyle(mbStyle) {
// analyzeStyle(mbStyle);
//
// const layers = mbStyle.layers;
// const sourceLayers = collect(layers, "source-layer");
//
// return sourceLayers.reduce(
//   (prev, curr) => ({
//     ...prev,
//     [curr]: getStyleForSourceLayer(curr, mbStyle),
//   }),
//   {}
//   );
// }

/**
 * @param {string} stylePath JSON style
 * @return {import('ol/style/flat').default}
 */
export async function convertToFlatStyle(stylePath) {
  const base = await fetch(stylePath).then((resp) => resp.json());
  const spritesheet = await fetch(`${base.sprite}.json`).then((resp) =>
    resp.json()
  );
  const spritesPath = `${base.sprite}.png`;

  analyzeStyle(base);

  return base.layers
    .filter(
      (layer) => layer.layout?.visibility !== "none" && layer.type !== "raster"
    )
    .map((layer) => getStyleForSourceLayer(layer, spritesheet, spritesPath));
}
