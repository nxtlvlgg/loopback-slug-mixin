var async = require("async");
var Promise = require("bluebird");
var xloop = require("xloop");
var resultCrawler = xloop.resultCrawler;
var reqCache = xloop.reqCache;
var watchSlug =  require("./watch-slug");
var slugFuncs = require("./slug-funcs");
var packageJSON = require("./package");



module.exports = function(Model, mixinOptions) {

    Model.dataSource.once("connected", function() {
        var ObjectId = Model.dataSource.connector.getDefaultIdType();
        var Slug = Model.app.models.slug;
        var foreignKeyName = Model.definition.name+"Id";

        // Add relation to slug model
        Model.hasMany(Slug, {as: "slugs", foreignKey: foreignKeyName});

        // Add properties and relations to slug model
        Slug.defineProperty(foreignKeyName, { type: ObjectId });
        Slug.belongsTo(Model, {as: Model.definition.name, foreignKey: foreignKeyName});
    });


    // Ensure the request object on every type of hook
    Model.beforeRemote('**', function(ctx, modelInstance, next) {
        reqCache.setRequest(ctx);
        next();
    });


    Model.observe("access", function(ctx, next) {
        ctx.req = reqCache.getRequest();
        async.series([
            findParent(Model, ctx)
        ], next);
    });


    Model.observe("before save", function(ctx, next) {
        ctx.req = reqCache.getRequest();
        return async.series([
            watchSlug(Model, mixinOptions, ctx)
        ], next);
    });


    Model.observe("after save", function(ctx, next) {
        return saveForeignKey(ctx, next);
    });




    Model.findBySlug = function(slug, filter, finalCb) {
        if (finalCb === undefined && typeof filter === "function") {
            finalCb = filter;
            filter = undefined;
        }

        finalCb = finalCb || new Promise();

        filter = filter || {};
        filter.where = {};
        var Slug = Model.app.models.slug;
        Slug.findOne({
            where: {
                "parentModelName": Model.definition.name,
                "slug": slug
            },
            include: {
                relation: Model.definition.name,
                scope: filter
            }
        }, function(err, instance) {
            if(err) return finalCb(err);
            if(!instance || !instance[Model.definition.name]) {
                var noModelErr = new Error('unable to find model');
                noModelErr.statusCode = 404;
                noModelErr.code = 'MODEL_NOT_FOUND';
                return finalCb(noModelErr)
            }

            var instanceJSON = instance.toJSON();
            return finalCb(undefined, instanceJSON[Model.definition.name]);
        });

        return finalCb.promise;
    };


    Model.remoteMethod(
        "findBySlug",
        {
            description: "Finds model by slug",
            accepts: [
                {arg: "slug", type: "string", required:true, http: {source: 'query'}},
                {arg: "filter", type: "object", required:false, http: {source: 'query'}},
            ],
            returns: { type: "object", root: true },
            http: {verb: 'get'},
            isStatic: true
        }
    );
};






function findParent(Model, ctx) {
    return function(finalCb) {

        if(!ctx.query.where || typeof ctx.query.where.slug !== "string") {
            return finalCb();
        }

        return Model.findBySlug(ctx.query.where.slug, ctx.query, finalCb);
    }
}