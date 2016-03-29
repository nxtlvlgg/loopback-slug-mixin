var xloop = require("xloop");
var resultCrawler = xloop.resultCrawler;
var packageJSON = require("./packageJSON");


function saveForeignKey(Model, mixinOptions, ctx) {
    return function(finalCb) {

        // Only update the foreignKey if this instance is new
        if (!state.ctx.isNewInstance) {
            return finalCb();
        }

        mixinOptions.mixinName = packageJSON.mixinName;
        mixinOptions.primitiveHandler = primitiveHandler;

        return resultCrawler.crawl(Model, mixinOptions, ctx, null, finalCb);
    }
}


function primitiveHandler(state, foreignKeyName, finalCb) {
    var Slug = state.models.slug;

    Slug.findOne({
        where: {
            parentModelName: state.modelName,
            baseKey: state.key
        },
        fields: {
            id: true
        }
    }, function(err, slug) {
        console.log("found slug", err, slug);
        if(err) return finalCb(err);

        return slug.updateAttribute(foreignKeyName, function(err) {
            console.log("updated slugs");
            if(err) return finalCb(err);
        });
    });
}


module.exports = saveForeignKey;