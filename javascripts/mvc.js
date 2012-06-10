// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){

  // Product Model
  // -------------

  // **Product** model has `name`, `price`, `fournisseur`
  //and `timestamp` attribute
  var Product = Backbone.Model.extend({
  })

  // Product List
  // ------------

  var ProductList = Backbone.Collection.extend({

    // Reference to this collection's model.
    model: Product,

    // Save all of the todo items under the `"products"` namespace.
    localStorage: new Store("products-backbone"),

    pieceFournisseurs: function(piece) {
      var data = [];

      // Select models by piece name
      var selectedModels = _.filter(this.models, function(product){
        return product.attributes.piece === piece
      });
      // and sort them by date to get latest price first
      selectedModels = _.sortBy(selectedModels, function(product){
        return 0 - moment(product.attributes.timestamp._d).valueOf();
      });

      _.each(selectedModels, function(product){

        // Find fournisseur already inside the list
        var fournisseur = _.find(data, function(existing_fournisseur){
          return existing_fournisseur.name == product.attributes.fournisseur;
        });

        // Existing fournisseur has not been found, push it in the list
        if(typeof(fournisseur) === "undefined"){
          data.push({
            name:product.attributes.fournisseur,
            price: {
              medium: [product.attributes.price], 
              latest: product.attributes.price,
              latest_date: moment(product.attributes.timestamp._d).format("DD/MM/YYYY")
            }
          });
        } else {
          // Existing fournisseur, just push price info
          fournisseur.price.medium.push(product.attributes.price);
        }
      });

      // Map list of price to compute medium price
      _.each(data, function(fournisseur){
        var total_medium = _.reduce(fournisseur.price.medium, function(memo, current){
          return memo + parseFloat(current);
        }, 0);
        fournisseur.price.medium = parseFloat(total_medium / fournisseur.price.medium.length);
      });

      return data;
    },

    // return data for select2 inputs
    selectData: function(attr) {
      var data = _.uniq(_.map(this.models, function(product){
        return product.attributes[attr]; 
      }));

      var index = -1;
      data = _.map(data, function(name){
        index += 1;
        return {id: index, text: name};
      });

      return data;
    },

    toCSV: function() {
      data = [_.compact(_.map(this.models[0].attributes, function(val, key){
        if(key === "id") return null;
        return key;
      })).join(",")]
      _.each(this.models, function(product){
        data.push(
          _.compact(_.map(product.attributes, function(val, key){
            if(key === "id") return null;
            if(key === "timestamp"){
              return moment(val._d).valueOf();
            } else {
              return val;
            }
          })).join(",")
        )
      });

      return data.join("\n");
    },

    plotInfo: function(piece, range_days) {
      var info = {data: [], ykeys: [], labels: []};

      var start_date = moment().subtract('days', range_days);

      // Select models by piece name and timestamp
      var selectedModels = _.filter(this.models, function(product){
        var product_date = moment(product.attributes.timestamp._d);
        var in_range = product_date.diff(start_date, 'days') > 0;
        return in_range && product.attributes.piece === piece
      });

      _.each(selectedModels, function(product){
        var date = moment(product.attributes.timestamp._d).format("YYYY-MM-DD");
        var fournisseur = product.attributes.fournisseur.toLowerCase().replace(/\s+/, '');
        var price = parseFloat(product.attributes.price);

        var existing_data = _.find(info['data'], function(data){
          return data['date'] === date;
        });

        if(typeof(existing_data) === "undefined"){
          var data = {date: date};
          data[fournisseur] = price;
          info['data'].push(data);
        } else {
          existing_data[fournisseur] = price;
        }
      });

      info['ykeys'] = _.uniq(_.map(selectedModels, function(product){
        return product.attributes['fournisseur'].toLowerCase().replace(/\s+/, '');
      }));

      info['labels'] = _.uniq(_.map(selectedModels, function(product){
        return product.attributes['fournisseur']; 
      }));

      return info;
    }

  });

  var Products = new ProductList;

  // Product Item View
  // -----------------

  // The DOM element for a product item...
  var ProductView = Backbone.View.extend({

    //... is a table row
    tagName:  "tr",

    // Cache the template function for a single item.
    template: _.template($('#piece-template').html()),

    renderPiece: function(piece) {
      if(Products.length > 0){
        var data = {piece: piece, fournisseurs: Products.pieceFournisseurs(piece)};
        return this.template(data);
      }
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.clear();
    }
  });

  // The Application
  // ---------------

  // Our overall **AppView** is the top-level piece of UI.
  var AppView = Backbone.View.extend({

    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#productapp"),

    // Delegated events for creating new products
    events: {
      "click #new-product":  "createOnEnter",
      "click #submitCSV":  "importCSV",
      "click #reveal-import":  "revealImport",
      "click #reveal-backup":  "revealBackup",
      "click .close-reveal-modal": "closeReveal",
      "click .plot-time": "changePlotTime",
      "click .display-plot": "displayPlot",
    },

    // At initialization we bind to the relevant events on the `Products`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting products that might be saved in *localStorage*.
    initialize: function() {
      this.input = this.$("#new-product");
      Products.bind('reset', this.refreshTable, this);
      Products.fetch();

      $("#fournisseurInput").select2({
        data: Products.selectData('fournisseur'),
        placeholder: "Choisissez un fournisseur",
        allowClear: true,
        createSearchChoice: function(term, data) {
          if ($(data).filter(function(){
            return this.text.localeCompare(term)===0;
          }).length===0) {
          return {id:term, text:term};
          }
        }
      });

      $("#pieceInput").select2({
        data: Products.selectData('piece'),
        placeholder: "Choisissez une pièce",
        allowClear: true,
        createSearchChoice: function(term, data) {
          if ($(data).filter(function(){
            return this.text.localeCompare(term)===0;
          }).length===0) {
            return {id:term, text:term};
          }
        }
      });

    },

    refreshTable: function() {
      this.$("#product-list").html("");
      _.each(_.uniq(Products.pluck("piece")), function(piece){
        var view = new ProductView;
        this.$("#product-list").append(view.renderPiece(piece));
      });
    },

    // If you hit return in the main input field, create new **Product** model,
    // persisting it to *localStorage*.
    createOnEnter: function(e) {

      var fournisseur_data = $("#fournisseurInput").data().select2.opts.data;
      var fournisseur_el = $("#fournisseurInput").val();
      if(isNaN(fournisseur_el)){
        fournisseur = fournisseur_el;
      } else {
        fournisseur = fournisseur_data[fournisseur_el].text;
      }

      var piece_data = $("#pieceInput").data().select2.opts.data;;
      var piece_el = $("#pieceInput").val();
      if(isNaN(piece_el)){
        piece = piece_el;
      } else {
        piece = piece_data[piece_el].text;
      }

      Products.create({
        fournisseur: fournisseur,
        piece: piece,
        price: parseFloat($("#priceInput").val()),
        timestamp: moment()
      });

      // Reset form
      $("#fournisseurInput").select2("val", "");
      $("#pieceInput").select2("val", "");
      $("#priceInput").val("");

      this.refreshTable();
    },

    revealImport: function() {
      $("#importModal").reveal();
    },

    revealBackup: function() {
      if(Products.length > 0)
        $("#backupCSV").val(Products.toCSV());
      $("#backupModal").reveal();
    },

    importCSV: function() {

      var array = jQuery.csv2json()($("#importCSV").val());
      var data = _.map(array, function(product){
        product.timestamp = moment(parseInt(product.timestamp) * 1000);
        console.log(product.timestamp.format("YYYY-MM-DD"));
        return product;
      });

      while(Products.length != 0){
        Products.each(function(model){model.destroy();});
      }

      _.each(data, function(product){
        console.log("create: " + product.price);
        Products.create(product);
      });
      console.log(Products.length);

      $("#importModal").trigger('reveal:close');

      this.refreshTable();
    },

    closeReveal: function() {
      $(".reveal-modal").trigger('reveal:close');
    },

    changePlotTime: function(event) {
      var target = event.target;
      var piece = event.target.rel;
      $(".plot-time").removeClass("nice green").addClass("white");
      $(target).removeClass("white").addClass("nice green");
      var plotInfo = Products.plotInfo(piece, parseInt(target.dataset.range));
      Morris.Line({
        element: 'plot',
        data: plotInfo.data,
        xkey: 'date',
        ykeys: plotInfo.ykeys,
        labels: plotInfo.labels,
        lineWidth: 2
      });
    },

    displayPlot: function(event) {
      var piece = event.target.rel;
      var plotInfo = Products.plotInfo(piece, 30);

      $(".plot-time").removeClass("nice green").addClass("white");
      $(".plot-time:first").removeClass("white").addClass("nice green");
      $(".plot-time").attr('rel', piece);

      Morris.Line({
        element: 'plot',
        data: plotInfo.data,
        xkey: 'date',
        ykeys: plotInfo.ykeys,
        labels: plotInfo.labels,
        lineWidth: 2
      });
    }

  });

  // Finally, we kick things off by creating the **App**.
  var App = new AppView;
});
