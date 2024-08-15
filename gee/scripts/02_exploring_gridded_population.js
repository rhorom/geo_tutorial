//Defining region of interest
var adm0 = ee.FeatureCollection("projects/ee-rho2mpersei-new/assets/nga_adm0");
var adm2 = ee.FeatureCollection("projects/ee-rho2mpersei-new/assets/nga_adm2_pop_2020")
  .select({propertySelectors:['ADM2_PCODE','ADM2_NAME','T_TL']});
  
//Acquiring population dataset: WorldPop 100 m
var wpgp = ee.ImageCollection("WorldPop/GP/100m/pop")
  .filterDate('2020-01-01','2020-12-31')
  .filterBounds(adm0).mosaic().clip(adm0);

//Acquiring population dataset: Landscan 1000 m
var landscan = ee.ImageCollection("projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL")
  .filterDate('2020-01-01','2020-12-31')
  .filterBounds(adm0).first().clip(adm0);

//Acquiring population dataset: GHS-POP 100 m
var ghsl = ee.Image("projects/sat-io/open-datasets/GHS/GHS_POP/GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0")
  .clip(adm0);

//Stacking population datasets as multiband image
wpgp = wpgp.rename('pop_wpgp')
  .addBands(landscan.rename('pop_landscan'))
  .addBands(ghsl.rename('pop_ghsl'));
  
//Performing zonal statistics: computing total population count at admin-2 level
var agg = wpgp.reduceRegions({
  reducer: ee.Reducer.sum(),
  collection: adm2,
  scale: 100
});

//Adding some important variables to the FeatureCollection
agg = agg.map(function(feat){
  var area = feat.area().multiply(1e-6);
  var x0 = feat.getNumber('T_TL');
  var x1 = feat.getNumber('pop_wpgp');
  var x2 = feat.getNumber('pop_landscan').multiply(0.01);
  var x3 = feat.getNumber('pop_ghsl');
  var d1 = x1.divide(area);
  
  feat = feat.set(
    'area', area,
    'pop_landscan', x2,
    'dens_wpgp', d1,
    'dev_wpgp', x1.subtract(x0),
    'dev_landscan', x2.subtract(x0),
    'dev_ghsl', x3.subtract(x0)
  );
  
  return feat;
});

print(agg)

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


// Output
var output = 'stats';
if (output == 'table'){
  // Exporting feature collection to Google Drive
  Export.table.toDrive({
    collection: agg,
    description: 'dataset_comparison',
    folder: 'gee',
    fileFormat: 'GeoJSON'
  });
} else if (output == 'map') {
  // Creating map
  var palettes = require('users/gena/packages:palettes');
  var palette = palettes.matplotlib.viridis[7];

  var vis = {min:0, max:10, palette:palette};
  
  var legendPanel = makeColorBar({min:0, max:5000, palette:palette}, 7, 'Population count')
  
  // Paint all the polygon edges with the same number and width, display.
  var dens = agg.reduceToImage({
    properties: ['dens_qpgp'],
    reducer: 'sum'
  });

  Map.centerObject(adm0, 6);
  Map.addLayer(ee.Image(1), {min:0, max:1, palette:['white', 'white']});
  Map.addLayer(wpgp.select('pop_wpgp'), vis, 'WPGP');
  Map.addLayer(dens, {min:0, max:5000, palette:palette}, 'Aggregated');
  Map.add(legendPanel);

} else if (output == 'stats'){
  // Calculating scores/statistics
  var census = ee.Array(agg.aggregate_array('T_TL'));
  var stat = ee.List(['dev_wpgp', 'dev_landscan', 'dev_ghsl']).map(function(dataset){
    var dev = agg.aggregate_array(dataset);
    var bias = dev.reduce({reducer:ee.Reducer.mean()});
    var mse = dev.map(function(x){return ee.Number(x).pow(2)}).reduce({reducer:ee.Reducer.mean()});
    var rmse = ee.Number(mse).sqrt();
    var mape = ee.Array(dev).abs().divide(census).toList()
      .reduce({reducer:ee.Reducer.mean()});
    return ee.Dictionary({'dataset':dataset, 'bias':bias, 'rmse':rmse, 'mape':mape});
  });
  
  print('SOME STATISTICS');
  print(stat);
} else if (output == 'chart'){
  // Creating scatter plot
  var chart = ui.Chart.feature.byFeature({
    features: agg,
    xProperty: 'T_TL',
    yProperties: ['pop_wpgp', 'pop_ghsl', 'pop_landscan']
  });
  var series = {
    0: {pointSize:5, lineWidth:0, pointShape: 'circle', color:'blue'},
    1: {pointSize:5, lineWidth:0, pointShape: 'circle', color:'green'},
    2: {pointSize:5, lineWidth:0, pointShape: 'circle', color:'red'},
  };
  var style = {
    hAxis: {title: 'HDX Data', scaleType:'log'},
    vAxis: {title: 'Gridded Dataset', scaleType:'log'},//, viewWindow: {min: -0.5, max: 2}},
    series: series
  };
  chart = chart.setOptions(style);
  print('COMPARISON TO CENSUS');
  print(chart);
  
  chart = ui.Chart.feature.byFeature({
    features: agg,
    xProperty: 'T_TL',
    yProperties: ['dev_wpgp', 'dev_ghsl', 'dev_landscan']
  });
  chart = chart.setOptions(style);
  print('DEVIATION FROM CENSUS');
  print(chart);
}
