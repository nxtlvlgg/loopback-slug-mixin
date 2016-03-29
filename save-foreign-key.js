var xloop = require("xloop");
var resultCrawler = xloop.resultCrawler;
var packageJSON = require("./package");



function saveForeignKey(Model, mixinOptions, ctx, foreignKeyName, finalCb) {

    // Only update the foreignKey if this instance is new
    if (!ctx.isNewInstance) {
        return finalCb();
    }

    mixinOptions.stateVars = {};
    mixinOptions.stateVars.foreignKeyName = foreignKeyName;
    mixinOptions.mixinName = packageJSON.mixinName;
    mixinOptions.primitiveHandler = primitiveHandler;

    return resultCrawler.crawl(Model, mixinOptions, ctx, null, finalCb);
}


function primitiveHandler(state, mixinOptions, finalCb) {
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
        if(err) return finalCb(err);

        return slug.updateAttribute(state.foreignKeyName, state.ctx.instance.id, function(err) {
            return finalCb(err);
        });
    });
}


module.exports = saveForeignKey;