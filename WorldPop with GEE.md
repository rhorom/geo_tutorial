# Population Data Analysis using Google Earth Engine
[**Rhorom Priyatikanto**](mailto:rp1y21@soton.ac.uk)<br>
WorldPop - University of Southampton

## Pre-requisites
1. Basic skill in _Javascript_ programming language
2. Basic knowledge on the Google Earth Engine
2. Basic understanding in GIS concepts, including raster and vector data processing and analysis

## Table of Contents
1. [Main courses](#main-courses)
2. [Introduction to gridded population data](#introduction)
3. [Gridded population data in GEE](#gridded-population-data-in-gee)
4. [Additional data: administrative boundary](#additional-data-administrative-boundary)
5. [Visualisation 1: map](#visualisation-1-map)
6. [Zonal statistics](#zonal-statistics)
7. [Visualisation 2: scater plot]()
8. [Computing some statistics]()

## Main courses
- Visualising gridded population data
- Data aggregation at a certain level of administrative unit
- Comparison between population estimates and the census data

## Introduction to gridded population data
In this tutorial, we will use Google Earth Engine (GEE) to perform some basic analysis to some selected gridded population datasets. Gridded population data refers to a representation of population distribution where estimates are assigned to regular grid cells across a specific geographic area, rather than being tied to traditional administrative boundaries. This data is usually stored in raster format, where each cell contains a population estimate or related attribute (e.g., density, age group).

Gridded data comes in various resolutions, often ranging from a few kilometers to less than 100 meters per cell. Higher resolution provides more detailed spatial information. It's typically derived from census data, satellite imagery, and other spatial datasets, using advanced modeling techniques to disaggregate population counts from administrative units to grid cells. Some explanations on how gridded population data is produced can be found [here](https://www.worldpop.org/methods/).


Gridded population data holds significant importance for a multitude of reasons:
- Improved Spatial Analysis: Unlike traditional census data tied to administrative boundaries, gridded data allows for more granular analysis at various spatial scales. This enables understanding population distribution patterns, density variations, and demographic characteristics within specific areas of interest.   

- Integration with Other Spatial Datasets: Gridded population data can be seamlessly integrated with other spatial datasets like land cover, environmental factors, or infrastructure, facilitating comprehensive analyses and informed decision-making across different domains.   

- Flexibility and Customization: It offers flexibility to aggregate population estimates into any desired spatial unit, whether administrative boundaries, catchment areas, or other custom-defined areas. This supports a wide range of applications, including resource allocation, urban planning, and disaster response.   

- Enhanced Accessibility: Gridded data, often available in open-access formats, improves accessibility for researchers, policymakers, and the general public, promoting data-driven insights and evidence-based decision-making.

- Addressing Data Gaps: In regions with limited or outdated census data, gridded population data provides a crucial alternative for estimating population distribution and demographics, supporting development planning and humanitarian assistance efforts.

- Facilitating Temporal Analysis: By incorporating temporal dimensions, gridded population data enables tracking population changes over time, helping understand migration patterns, urbanization trends, and the impact of various interventions.

## Gridded population data in GEE
In GEE we can easily find several gridded population datasets, e.g., by typing 'population' in the searching field on top of the Code Editor. Comprehensive description on the dataset can be found in the catalog.

| Dataset | Spatial Resolution | Temporal Coverage | Link |
| ------- | ------------------ | ----------------- | ---- | 
| GHS Population Surface | 100 m | 1975 - 2030 | [&#10149;](https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_POP) | 
| LandScan Population Data Global| 1000 m | 2000 - 2022 | [&#10149;](https://developers.google.com/earth-engine/datasets/catalog/projects_sat-io_open-datasets_ORNL_LANDSCAN_GLOBAL) | 
| WorldPop Global Project Population Data | 100 m | 2000 - 2021 | [&#10149;](https://developers.google.com/earth-engine/datasets/catalog/WorldPop_GP_100m_pop#image-properties) |


The datasets listed above are stored in GEE either as `Image` or `ImageCollection`. We can acquire the datasets using the following commands:

```
//Importing gridded population data
var wpgp = ee.ImageCollection("WorldPop/GP/100m/pop")
  .filterDate('2020-01-01','2020-12-31');

var landscan = ee.ImageCollection("projects/sat-io/open-datasets/ORNL/LANDSCAN_GLOBAL")
  .filterDate('2020-01-01','2020-12-31');

var ghsl = ee.Image("projects/sat-io/open-datasets/GHS/GHS_POP/GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0");
```
At this stage, `wpgp` and `landscan` are both `FeatureCollection` while `ghsl` is and `Image`. To overview the contents a variable, use `print()` function and check what is printed in the Console.
```
print(wpgp);
/*
ImageCollection WorldPop/GP/100m/pop (249 elements)
    type: ImageCollection
    id: WorldPop/GP/100m/pop
    version: 1641990785000383
    bands: []
    features: List (249 elements)
    properties: Object (23 properties)
*/

print(ghsl);
/*
Image projects/sat-io/open-datasets/GHS/GHS_POP/GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0 (1 band)
    type: Image
    id: projects/sat-io/open-datasets/GHS/GHS_POP/GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0
    version: 1694031061502556
    bands: List (1 element)
        0: "b1", double, PROJCS…
    properties: Object (6 properties)
        id_no: GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0
        num_bands: 1
        system:asset_size: 4912320281
        system:index: GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0
        xsize: 360820
        ysize: 180000
*/
```

For `ImageCollection`, filtering can be conducted based on the property recorded in the collection. Generally, we can use `filter()` method for this task while `filterDate()` is a specific method for filtering based on the date or timestamp. The `filter()` requires an `Filter` class as the input whereas `filterDate()` needs start-date and end-date as inputs. The dates can also be expressed as *milliseconds since 1970-01-01T00:00Z*.

To be more annotative, the following command
```
var wpgp_2020 = wpgp.filterDate('2020-01-01', '2020-12-31')
```
gives the same result as
```
var wpgp_2020 = wpgp.filter(ee.Filter.date(1577836800000, 1609372800000))
```

Besides `filterDate()`, `filterBounds()` becomes another method commonly used to filter a collection of data. This method returns data that intersects the geometry boundary provided as the input. We will use this method later.

## Additional data: administrative boundary
Suppose we want to do analysis on a specific country, namely Nigeria. From the [Humanitarian Data Exchange](https://data.humdata.org/dataset/cod-ps-nga), we can find Nigeria population data 2020. This data can be merged with the associated administrative units which can also be found in the same website. The administrative boundary data can be found [here](https://data.humdata.org/dataset/cod-ab-nga). Administrative boundary at level 0 (country boundary) and level 2 (local government area) will be needed in this tutorial. After merging, we have a shapefile containing geometry of the administrative boundaries (level 2) and the demographic data attached to the units. Among tens of columns defining the demography, we now focus on the total population (`T_TL`).

To enable processing and analyses in GEE, the shapefile defining the administrative boundary should be uploaded to the GEE assets. Uploading can easily be done by through the following steps:
1. In the Code Editor, navigate to the Assets tab.
2. Click the New button and select the appropriate data type (Shapefile, GeoJSON, or CSV).
3. Browse and select your Zip file containing the shapefile.
4. Assign a unique asset ID.
5. Click Upload and wait for the ingestion process to complete.

A new `FeatureCollection` will be created after each successful upload. Click the asset to get more information about it, including the path to access the data.

Then, we can load the region of interest to the Code Editor.
```
//Importing administrative boundaries to define the region of interest
var adm2 = ee.FeatureCollection("projects/ee-rho2mpersei-new/assets/nga_adm2_pop_2020")
  .select({propertySelectors:['ADM2_PCODE','ADM2_NAME','T_TL']});
```
Originally, `nga_adm2_pop_2020` contains more than 60 columns but we only select administrative unit identifications (`ADM2_PCODE`, `ADM2_NAME`) and the total population count (`T_TL`). Selection is done using `select()` method for `FeatureCollection` class. The geometry column is automatically included.

## Visualisation 1: map
As a quick look, we create a map displaying the population count at admin-2 level based on the Nigeria data we just uploaded.
```
var empty = ee.Image(1).float();
Map.centerObject(adm2, 6);
Map.addLayer(empty, {min:0, max:1, palette:['white','white']}, 'bg');
Map.addLayer(adm2, {color:'blue', width:1}, 'Boundary');
```
The above commands center the map view at the region of interest (a). 

![](fig/nga_adm2.PNG)

We can create a choropleth based on the total population count at admin-2 level and add it to the map (b). This can be done by rasterising the `FeatureCollection` into an `Image` and then transforming the population count into a selected color palette.

```
var empty = ee.Image(1).float();
var choropleth = empty.paint({
  featureCollection: adm2,
  color: 'T_TL'
});
Map.addLayer(choropleth, {min:0, max:1e6, palette:['white', 'blue', 'darkblue']}, 'pop');
```

Getting back to the gridded population data we have imported, we need to filter the collection based on the defined region of interest. This step will make the overall process more efficient. The `filterBounds()` method from the `ImageCollection` class can be used for this purpose. As the input, this function requires `Geometry` or `Feature` containing geometry.
```
wpgp = wpgp.filterBounds(adm2).mosaic().clip(adm2);
landscan = landscan.filterBounds(adm2).first().clip(adm2);
ghsl = ghsl.clip(adm2);
```
Additional to the filtering, mosaicing of multiple image tiles from `wpgp` dataset transforms `ImageCollection` into an `Image`. Meanwhile, the `first()` method is implemented to select the first image in the `landscan` collection. How the data is stored in the collection determines the way we get the image/raster data from it.

At this stage, all gridded datasets are in the form of `Image`. We can stack all images into a multiband image for easier analysis. All bands in an `Image` do not have to share the same scale and projection.
```
var stack = wpgp.rename('pop_wpgp')
  .addBands(landscan.rename('pop_landscan'))
  .addBands(ghsl.rename('pop_ghsl'));
```

Visualisation of the raster data is a straightforward process. Nevertheless, `pop_landscan` layer needs to be multiplied by `0.01` so it can match with the visualisation parameters defined in `vis`. This minor adjustment is required as `pop_landscan` has a spatial resolution of 1000 m while the other bands (`pop_wpgp` and `pop_ghsl`) are at 100 m.

```
var nSteps = 7;
var palettes = require('users/gena/packages:palettes');
var palette = palettes.matplotlib.viridis[nSteps];

var vis = {min:0, max:10, palette:palette};
Map.addLayer(stack.select('pop_wpgp'), vis, 'WPGP');
Map.addLayer(stack.select('pop_landscan').multiply(0.01), vis, 'Landscan');
Map.addLayer(stack.select('pop_ghsl'), vis, 'GHSL');

```
![](fig/pop_raster.PNG)

## Zonal statistics
Visually, the difference between gridded datasets is perceivable though further quantitative analysis can be conducted to assess their compatibility. We will aggregate the gridded data to admin-2 level so that comparison can be done, including the comparison between gridded datasets and the census data summarised at administrative units. To simplify the case, the population table obtained from the Humanitarian Data Exchange is assumed to be the census data. The following commands do the aggregation.

```
//Performing zonal statistics: computing total population count at admin-2 level
var agg = wpgp.reduceRegions({
  reducer: ee.Reducer.sum(),
  collection: adm2,
  scale: 100
});
```

Again, the count from the LandScan dataset requires adjustment as the aggregation is done at 100-m scale. Extra variables can also be computed in the same iteration.
```
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
```
Some explanations on the commands above:
- `agg` is a `FeatureCollection` with properties similar to that of `adm2` but with three extras, namely:
    - `pop_wpgp` total population from WorldPop dataset
    - `pop_landscan` total population from LandScan dataset. This value needs to be multiplied by `0.01`.
    - `pop_ghsl` total population from GHS-POP dataset
    
- A function is mapped over the collection. For each feature in the collection, the function adds the following properties:
    - `area`: area of the administrative unit in square kilometer
    - `pop_landscan`: the original value is multiplied by `0.01`
    - `dens_wpgp`: population density in persons per square kilometer
    - `dev_wpgp`, `dev_landscan`, `dev_ghsl`: deviation between population count from gridded data and the 'census data'.

