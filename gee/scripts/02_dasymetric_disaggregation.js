// Defining region of interest
var geometry = ee.Geometry.Point(13.0,55.6); //a point in Skaane County, Sweden
var adm1 = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level1")
  .filterBounds(geometry)
  .select(['ADM1_NAME', 'ADM1_CODE']);
  
var adm2 = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2")
  .filterBounds(adm1)
  .select(['ADM1_NAME', 'ADM1_CODE', 'ADM2_NAME', 'ADM2_CODE']);

// Acquiring population dataset: WorldPop 100 m
var wpgp = ee.ImageCollection("WorldPop/GP/100m/pop")
  .filterDate('2020-01-01','2020-12-31')
  .filterBounds(adm1).mosaic().clip(adm1).rename('pop_wpgp');

// Acquiring ancillary data: VIIRS annual composite
var viirs = ee.ImageCollection("NOAA/VIIRS/DNB/ANNUAL_V21")
  .filterDate('2020-01-01','2020-12-31')
  .filterBounds(adm1).first().clip(adm1).select('median');
viirs = viirs.where(viirs.lt(0.25), ee.Image(0));

// Acquiring ancillary data: GHSL residential building volume
var ghsv = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_V/2020')
  .clip(adm1);
var ghsl = ghsv.select('built_volume_total')
  .subtract(ghsv.select('built_volume_nres'));

// Stacking images into a multiband image
wpgp = wpgp.rename('pop')
  .addBands(viirs.rename('viirs'))
  .addBands(ghsl.rename('ghsl'));
  
// Aggregation at admin-1 level
var pop1 = wpgp.reduceRegions({
  collection: adm1,
  scale: 100,
  reducer: ee.Reducer.sum()
});

// Computing multiplying factors
pop1 = pop1.map(function(feat){
  var pop = feat.getNumber('pop');
  var f1 = pop.divide(feat.getNumber('viirs'));
  var f2 = pop.divide(feat.getNumber('ghsl'));
  return feat.set('f1', f1, 'f2', f2);
});

// Rasterisation
var f1 = pop1.reduceToImage({
  properties: ['f1'],
  reducer: ee.Reducer.sum()
});

var f2 = pop1.reduceToImage({
  properties: ['f2'],
  reducer: ee.Reducer.sum()
});

// Proportional redistribution
var e1 = wpgp.select('viirs').multiply(f1);
var e2 = wpgp.select('ghsl').multiply(f2);
var estimate = wpgp.select('pop')
  .addBands(e1.rename('est_viirs'))
  .addBands(e2.rename('est_ghsl'));

// Aggregation at admin-2 level for assessment
var pop2 = estimate.reduceRegions({
  collection: adm2,
  scale: 100,
  reducer: ee.Reducer.sum()
});
pop2 = pop2.map(function(feat){
  var pop = feat.getNumber('pop');
  var e1 = feat.getNumber('est_viirs');
  var e2 = feat.getNumber('est_ghsl');
  
  return feat.set(
    'ref', pop,
    'dev_viirs', e1.subtract(pop),
    'dev_ghsl', e2.subtract(pop)
    );
});


function makeColorBar(vis, n, title){
    var params = {
        bbox: [0, 0, n, 0.1],
        dimensions: '100x10',
        format: 'png',
        min: 0,
        max: n,
        palette: vis.palette,
    };

    // Create the colour bar for the legend
    var colorBar = ui.Thumbnail({
        image: ee.Image.pixelLonLat().select(0).int(),
        params: params,
        style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
    });
    
    // Create a panel with three numbers for the legend
    var legendLabels = ui.Panel({
        widgets: [
            ui.Label(vis.min, {margin: '4px 8px'}),
            ui.Label(
                ((vis.max-vis.min) / 2+vis.min),
                {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
            ui.Label(vis.max, {margin: '4px 8px'})
        ],
        layout: ui.Panel.Layout.flow('horizontal')
    });

    // Legend title
    var legendTitle = ui.Label({
        value: title,
        style: {fontWeight: 'bold'}
    });

    return ui.Panel([legendTitle, colorBar, legendLabels]);
}

var palettes = require('users/gena/packages:palettes');
var palette = palettes.misc.coolwarm[7];
var vis = {min:0, max:50, palette:palette};

var output = 'pop'; //options: ['pop', 'dev', 'cbar', 'chart', 'gdrive']
if (output == 'gdrive'){
    // Exporting raster to Google Drive
    Export.image.toDrive({
        image: estimate,
        description: 'dasymetric_viirs',
        folder: 'gee',
        region: adm1,
        fileFormat: 'GeoTIFF',
        crs: 'EPSG:4326',
        scale: 100
    });
  } else if (output == 'cbar'){
    // Creating colorbar
    var legendPanel = makeColorBar(vis, 7);
    Map.add(legendPanel);

} else if (output == 'dev'){
    // Rasterisation
    var d1 = pop2.reduceToImage({
        properties:['dev_viirs'],
        reducer:'sum'
    }).clip(adm1);
    
    var d2 = pop2.reduceToImage({
        properties:['dev_ghsl'],
        reducer:'sum'
    }).clip(adm1);
  
    vis = {min:-3e4, max:3e4, palette:palette}
    // Creating map
    Map.centerObject(geometry, 8);
    Map.addLayer(ee.Image(1), {palette:['white']});
    Map.addLayer(d1, vis, 'VIIRS');
    Map.addLayer(d2, vis, 'GHSL');

    // Adding colorbar
    var legendPanel = makeColorBar({min:-30, max:30, palette:palette}, 7, 'Deviation (in thousands)');
    Map.add(legendPanel);

} else if (output == 'pop'){
    palette = ['000004', '51127c', 'b73779', 'fc8961', 'fcfdbf'];
    vis = {min:0, max:50, palette:palette};
    Map.addLayer(wpgp.select('pop'), vis, 'WPGP');
    Map.addLayer(estimate.select('est_viirs'), vis, 'Dasymetric_VIIRS');
    Map.addLayer(estimate.select('est_ghsl'), vis, 'Dasymetric_GHSL');
    
    // Adding colorbar
    var legendPanel = makeColorBar(vis, 7, 'Population count (per hectare)');
    Map.add(legendPanel);

} else if (output == 'chart') {
    var chart = ui.Chart.feature.byFeature({
        features: pop2,
        xProperty: 'pop',
        yProperties: ['ref', 'est_viirs', 'est_ghsl']
    });
    
    var series = {
        0: {pointSize:0, lineWidth:1, color:'black'},
        1: {pointSize:5, lineWidth:0, pointShape: 'circle', color:'green'},
        2: {pointSize:5, lineWidth:0, pointShape: 'circle', color:'red'},
    };

    var lim = {min:5e3, max:5e5};
    var style = {
        hAxis: {title: 'WorldPop', scaleType:'log', viewWindow:lim},
        vAxis: {title: 'Simple Dasymetric', scaleType:'log', viewWindow:lim},
        series: series
    };
    
    chart = chart.setOptions(style);
    print(chart);
}