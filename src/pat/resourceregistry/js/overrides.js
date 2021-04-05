import $ from "jquery";
import BaseView from "../../../core/ui/views/base";
import _ from "underscore";
import _t from "../../../core/i18n-wrapper";
import utils from "../../../core/utils";
import CodeEditor from "pat-code-editor";
import Select2 from "../../select2/select2";

export default BaseView.extend({
    tagName: "div",
    className: "tab-pane overrides",
    editing: null,
    canSave: false,
    newFile: false,

    template: _.template(
        '<div class="buttons-container">' +
            '<div class="btn-group pull-right">' +
            '<button class="plone-btn plone-btn-primary add-file"><%- _t("Add file") %></button> ' +
            "</div>" +
            "</div>" +
            '<form class="row">' +
            '<div class="col-md-12">' +
            '<p><%- _t("Only ++plone++ resources are available to override") %></p>' +
            '<input class="select" type="hidden" placeholder="<%- _t("Select resource to override...") %>" style="width: 100%" />' +
            "</div>" +
            "</form>" +
            '<div class="row">' +
            '<div class="col-md-12 edit-area">' +
            "<% if(view.editing){ %>" +
            '<p class="resource-name text-primary"><%- view.editing %></p> ' +
            '<div class="plone-btn-group">' +
            '<button class="plone-btn plone-btn-primary plone-btn-xs" disabled><%- _t("Save") %></button> ' +
            '<button class="plone-btn plone-btn-default plone-btn-xs" disabled><%- _t("Cancel") %></button>' +
            '<button class="plone-btn plone-btn-danger plone-btn-xs"><%- _t("Delete customizations") %></button>' +
            "</div>" +
            "<% } %>" +
            '<div class="editor" />' +
            "</div>" +
            "</div>"
    ),
    events: {
        "click .edit-area button.plone-btn-danger": "itemDeleted",
        "click .edit-area button.plone-btn-primary": "itemSaved",
        "click .edit-area button.plone-btn-default": "itemCancel",
        "click .plone-btn.add-file": "addFile",
    },

    initialize: function (options) {
        BaseView.prototype.initialize.apply(this, [options]);
        this.tabView = options.tabView;
    },

    serializedModel: function () {
        return $.extend({}, { view: this }, this.options);
    },

    addFile: function () {
        var resource = window.prompt(
            "Enter full path and filename",
            "++plone++static/" + _t("you-filename.js")
        );
        if (resource.indexOf("++plone++static/") === -1) {
            window.alert(_t("Filename must start with ++plone++static/"));
        } else {
            if (this.options.data.overrides.indexOf(resource) === -1) {
                this.options.data.overrides.push(resource);
            }
            this.newFile = true;
            this.editing = resource;
            this.render();
        }
    },

    itemSaved: function (e) {
        e.preventDefault();
        var that = this;
        that.tabView.saveData(
            "save-file",
            {
                filepath: that.editing,
                data: that.editor.editor.getValue(),
            },
            function () {
                that.$el
                    .find(".plone-btn-primary,.plone-btn-default")
                    .prop("disabled", true);
            }
        );
    },

    itemDeleted: function (e) {
        e.preventDefault();
        var that = this;
        if (window.confirm("Are you sure you want to delete this override?")) {
            that.options.data.overrides.splice(
                that.options.data.overrides.indexOf(that.editing),
                1
            );
            that.tabView.saveData(
                "delete-file",
                {
                    filepath: that.editing,
                },
                function () {
                    that.editing = null;
                    that.render();
                }
            );
        }
    },

    itemCancel: function (e) {
        e.preventDefault();
        this.editing = null;
        this.render();
    },

    customizeResource: function (resource) {
        if (this.options.data.overrides.indexOf(resource) === -1) {
            this.options.data.overrides.push(resource);
        }
        this.editing = resource;
        this.render();
    },

    afterRender: function () {
        var that = this;
        var $select = that.$el.find(".select");
        var overrides = _.map(that.options.data.overrides, function (override) {
            return {
                id: override,
                text: override,
                override: true,
            };
        });
        var resources = _.flatten(
            _.map(that.options.data.resources, function (resource) {
                var base = resource.url || "";
                if (base) {
                    base += "/";
                }
                var items = [];
                var url;
                if (resource.js) {
                    if (
                        resource.js &&
                        resource.js.indexOf("++plone++") !== -1
                    ) {
                        url = base + resource.js;
                        if (overrides.indexOf(url) === -1) {
                            items.push({ id: url, text: url });
                        }
                    }
                }
                if (resource.css) {
                    for (var i = 0; i < resource.css.length; i = i + 1) {
                        url = base + resource.css[i];
                        if (
                            overrides.indexOf(url) === -1 &&
                            url.indexOf("++plone++") !== -1
                        ) {
                            items.push({ id: url, text: url });
                        }
                    }
                }
                return items;
            })
        );

        var format = function (data) {
            if (data.override) {
                return (
                    '<span class="customized">' +
                    data.text +
                    " - " +
                    _t("customized") +
                    "</span>"
                );
            }
            return data.text;
        };
        that.select2 = new Select2($select, {
            data: overrides.concat(
                _.sortBy(resources, function (d) {
                    return d.id;
                })
            ),
            formatResult: format,
            formatSelection: format,
        });

        $select.on("change", function () {
            that.customizeResource($select.select2("val"));
        });

        that.$editorContainer = that.$(".editor");
        if (that.editing !== null) {
            var url = that.options.data.baseUrl;
            if (url[url.length - 1] !== "/") {
                url += "/";
            }
            if (that.newFile) {
                that.showEditor("");
                that.newFile = false;
            } else {
                that.tabView.loading.show();
                $.ajax({
                    // cache busting url
                    url: url + that.editing + "?" + utils.generateId(),
                    dataType: "text",
                })
                    .done(function (data) {
                        that.showEditor(data);
                    })
                    .fail(function () {
                        window.alert(_t("error loading resource for editing"));
                        that.tabView.loading.hide();
                    });
            }
        }
    },

    showEditor: function (data) {
        const editor_el = document.createElement("textarea");
        editor_el.setAttribute("class", "pat-code-editor");
        editor_el.setAttribute(
            "data-pat-code-editor",
            `language: ${this.editing}`
        );
        editor_el.value = data;
        this.$editorContainer[0].innerHTML = "";
        this.$editorContainer[0].appendChild(editor_el);
        this.editor = new CodeEditor(editor_el);
        this.editor.codeeditor.onUpdate(() => {
            this.$el
                .find(".plone-btn-primary,.plone-btn-default")
                .prop("disabled", false);
        });

        this.tabView.loading.hide();
    },
});
