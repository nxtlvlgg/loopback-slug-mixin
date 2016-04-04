var xloop = require("xloop");
var async = require("async");
var resultCrawler = xloop.resultCrawler;
var packageJSON = require("./package");
var slugFuncs = require("./slug-funcs");


function watchSlug(Model, mixinOptions, ctx, finalCb) {

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

    // Is this a brand new model being saved
    if (state.ctx.isNewInstance) {
        return createSlug(state.ctx.instance, state, slugOptions, finalCb);
    }

    // Find the instances in this update and the slug based on this key
    return state.model.find({
        where: state.ctx.where,
        include: {
            relation: "slugs",
            scope: {
                where: {
                    baseKey: state.key,
                    parentModelName: state.modelName
                },
                fields: {
                    id: true,
                    linked: true,
                    slug:true
                },
                limit: 1
            }
        }
    }, function(err, modelInstances) {
        if(err) return finalCb(err);

        return async.each(modelInstances, function(modelInstance, instanceCb) {
            var instanceJSON = modelInstance.toJSON();
            if (instanceJSON.slugs < 1) {
                return createSlug(modelInstance, state, slugOptions, finalCb);
            }
            return updateSlug(instanceJSON.slugs[0], state, slugOptions, finalCb);
        }, finalCb);
    });
}

function createSlug(instance, state, slugOptions, finalCb) {

    var linked = (  slugOptions.linked === undefined
    || slugOptions.linked === null  )
        ? true : slugOptions.linked;
    var slug = (!linked && typeof slugOptions.slug === "string")
        ? slugOptions.slug : slugify(state.data);

    // Add slug modifiers
    var prefixFunc = slugFuncs[slugOptions.prefixFunc];
    if (typeof prefixFunc === "function") {
        slug = prefixFunc(instance) + slug;
    } else if (typeof slugOptions.prefix === "string") {
        slug = slugOptions.prefix + slug;
    }

    return instance.slugs.create({
        slug: slug,
        linked: linked,
        baseKey: state.key,
        parentModelName: state.modelName
    }, finalCb);
}

function updateSlug(slugInstance, state, slugOptions, finalCb) {
    var changes = {};
    var linked = slugInstance.linked || true;

    // Did the user include linked option?
    if (slugOptions && typeof slugOptions.linked === "boolean") {
        linked = slugOptions.linked
    }

    // Has the linked value changed?
    if (linked !== slugInstance.linked) {
        changes.linked = linked;
    } else {
        linked = slugInstance.linked;
    }

    // Has the slug changed?
    var slug = slugify(state.data);

    // Add slug modifiers
    var prefixFunc = slugFuncs[slugOptions.prefixFunc];
    if (typeof prefixFunc === "function") {
        slug += prefixFunc(instance);
    } else if (typeof slugOptions.prefix === "string") {
        slug += slugOptions.prefix;
    }

    if (linked && (slug !== slugInstance.slug)) {
        changes.slug = slug;
    } else if (!linked && (slugOptions.slug !== slugInstance.slug)) {
        changes.slug = slugOptions.slug;
    }

    // Do we need to apply updates?
    if (Object.keys(changes).length < 1) {
        return finalCb();
    }

    // Apply updates
    var Slug = state.models.slug;
    return Slug.updateAll({ id: slugInstance.id}, changes, finalCb);
}


function slugify(string) {
    return (string) ? string.toLowerCase().replace(/-+/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
}


module.exports = watchSlug;