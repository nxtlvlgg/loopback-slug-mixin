var xloop = require("xloop");
var resultCrawler = xloop.resultCrawler;
var packageJSON = require("./package");



function saveForeignKey(Model, mixinOptions, ctx, foreignKeyName, finalCb) {

    // Only update the foreignKey if this instance is new
    if (!state.ctx.isNewInstance) {
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
        console.log("found slug", err, slug);
        if(err) return finalCb(err);

        console.log("updating foreguinKEyname", mixinOptions.foreignKeyName);
        return slug.updateAttribute(mixinOptions.foreignKeyName, function(err) {
            console.log("updated slugs");
            if(err) return finalCb(err);
        });
    });
}


module.exports = saveForeignKey;