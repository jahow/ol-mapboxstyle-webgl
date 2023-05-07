function collect(objects, propName) {
  return objects.reduce((prev, curr) => {
    const value =
      typeof curr[propName] === "string"
        ? curr[propName]
        : JSON.stringify(curr[propName]);
    return prev.indexOf(value) > -1 ? prev : [...prev, value];
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
    `Sources: ${Object.keys(mbStyle.sources).map(
      (s) => `${s} (${sources[s].type})`
    )}`
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
  return {
    filter: ["any", ...layers.filter((l) => !!l.filter).map((l) => l.filter)],
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
