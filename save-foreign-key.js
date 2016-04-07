var xloop = require("xloop");
var resultCrawler = xloop.resultCrawler;
var packageJSON = require("./package");
var slugFuncs = require("./slug-funcs");



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

    // Get options from modelConfig
    var slugOptions = {};
    var modelSlugOptions = state.modelProperties[mixinOptions.mixinName];
    if (typeof modelSlugOptions === "object") {
        for (var key in modelSlugOptions) {
            slugOptions[key] = modelSlugOptions[key];
        }
    }

    // Add any potential options from the client
    if (state.ctx.req && state.ctx.req.body && typeof state.ctx.req.body.slugOptions === "object") {
        for (var key in state.ctx.req.body.slugOptions) {
            slugOptions[key] = state.ctx.req.body.slugOptions[key];
        }
    }

    var linked = (  slugOptions.linked === undefined
    || slugOptions.linked === null  )
        ? true : slugOptions.linked;
    var slug = (!linked && typeof slugOptions.slug === "string")
        ? slugOptions.slug : slugify(state.data);

    // Add slug modifiers
    var prefixFunc = slugFuncs[slugOptions.prefixFunc];
    if (typeof prefixFunc === "function") {
        slug = prefixFunc(state.requestData) + slug;
    } else if (typeof slugOptions.prefix === "string") {
        slug = slugOptions.prefix + slug;
    }

    // Update the slug with the new foreign key
    var update = {
        "$set": {}
    };
    update["$set"][state.foreignKeyName] = state.ctx.instance.id;

    var Slug = state.models.slug;
    return Slug.updateAll(
        {
            parentModelName: state.modelName,
            baseKey: state.key,
            slug: slug
        },
        update,
        { allowExtendedOperators: true },
        function(err, info) {
            return finalCb(err);
        });
}

function slugify(string) {
    return (string) ? string.toLowerCase().replace(/-+/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
}



module.exports = saveForeignKey;