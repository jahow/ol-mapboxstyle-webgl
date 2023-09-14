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

/**
 * @param {string} sourceLayer
 * @param {Object} mbStyle JSON style
 * @return {Object}
 */
function getStyleForSourceLayer(sourceLayer, mbStyle) {
  const layers = mbStyle.layers
    .filter((l) => l["source-layer"] === sourceLayer)
    .filter((l) => l?.layout?.visibility === "visible");
  const filters = collect(layers, "filter");
  const filter = filters.length
    ? simplifyExpression(["any", ...filters])
    : undefined;
  if (!layers[0]) {
    return { filter };
  }
  return {
    filter,
    ...layers[0].paint,
    ...layers[0].layout,
  };
}

/**
 * @param {Object} mbStyle JSON style
 */
export function convertToFlatStyle(mbStyle) {
  analyzeStyle(mbStyle);

  const layers = mbStyle.layers;
  const sourceLayers = collect(layers, "source-layer");

  return sourceLayers.reduce(
    (prev, curr) => ({
      ...prev,
      [curr]: getStyleForSourceLayer(curr, mbStyle),
    }),
    {}
  );
}
