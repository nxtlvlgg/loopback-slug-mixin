var xloop = require("xloop");
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

    // Try to find slug based on this key
    var Slug = state.models.slug;
    var fields = {id: true};
    fields[state.key] = true;
    var query = {
        where: {
            baseKey: state.key,
            parentModelName: state.modelName
        },
        fields: fields
    };
    return Slug.findOne(query, function (err, slug) {
        if (err) return finalCb(err);
        if (!slug) {
            return createSlug(state.ctx.instance, state, slugOptions, finalCb);
        }

        return updateSlug(slug, state.ctx.instance, state, slugOptions, finalCb);
    });


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

    function updateSlug(slugInstance, instance, state, slugOptions, finalCb) {
        var changes = {};

        // Did the user include linked option?
        var linked;
        if (slugOptions.linked !== undefined || slugOptions.linked !== null) {
            linked = slugOptions.linked
        }

        // Has the linked value changed?
        if (linked !== undefined && linked !== slugInstance.linked) {
            changes.linked = linked;
        } else if (linked === undefined) {
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

        return slugInstance.updateAttributes(changes, finalCb);
    }
}


function slugify(string) {
    return (string) ? string.toLowerCase().replace(/-+/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
}


module.exports = watchSlug;