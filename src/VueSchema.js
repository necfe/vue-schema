import UINode from './UINode';
import merge from 'lodash/merge';

const SIMPLE_WORDS = 'tag,text,bindingText,slot,key,ref'.split(',');
const OBJECT_WORDS = 'class,style,attrs,bindingAttrs,props,domProps,on,nativeOn,directives,scopedSlots,others'.split(',');
const ARRAY_WORDS = 'directives'.split(',');

function _merge(schema1, schema2) {
    const schema = {
        model: Object.assign({}, schema1.model, schema2.model),
        uiSchema: undefined,
        dependencies: [].concat(schema1.dependencies, schema2.dependencies),
        watchers: [].concat(schema1.watchers, schema2.watchers),
    };

    const vueSchema = new VueSchema(schema);
    vueSchema.uiSchema = (schema1.uiSchema && schema2.uiSchema) ? _mergeUI(schema1.uiSchema, schema2.uiSchema) : (schema1.uiSchema || schema2.uiSchema);
    vueSchema.uiRefs = {};
    vueSchema.uiSchema && VueSchema.handleUI(vueSchema.uiSchema, [
        (ui) => {
            if (ui.ref)
                vueSchema.uiRefs[ui.ref] = ui;
        },
    ]);
    return vueSchema;
}

function _mergeUI(ui1, ui2, parent) {
    const ui = {};

    // 允许后者将前者的tag直接覆盖
    SIMPLE_WORDS.forEach((word) => ui[word] = ui2[word] || ui1[word]);
    OBJECT_WORDS.forEach((word) => ui[word] = merge({}, ui1[word], ui2[word]));
    ARRAY_WORDS.forEach((word) => ui[word] = [].concat(ui1[word] || [], ui2[word] || []));

    const uiNode = new UINode(ui, parent);

    const children = [];
    const maxLength = Math.max(ui1.children.length, ui2.children.length);

    for (let i = 0; i < maxLength; i++) {
        const child1 = ui1.children[i];
        const child2 = ui2.children[i];

        if (child1 && child2)
            children[i] = _mergeUI(child1, child2, uiNode);
        else if (!child1 && !child2)
            ; // ignore
        else
            children[i] = new UINode(child2 || child1, uiNode);
    }

    uiNode.children = children;
    uiNode.child = children && children[0];

    return uiNode;
}

class VueSchema {
    // version: string;
    // model: Object;
    // uiSchema: UINode;
    // dependencies: Array;
    // watchers: Array;

    constructor(schema) {
        this.version = schema.version;

        const model = schema.model || {};
        Object.keys(model).forEach((key) => {
            // json 里面只能用 null，这里统一视为 undefined
            if (model[key] === null)
                model[key] = undefined;
        });
        this.model = model;

        this.uiSchema = schema.uiSchema && new UINode(schema.uiSchema);
        this.uiRefs = {};
        this.uiSchema && VueSchema.handleUI(this.uiSchema, [
            (ui) => {
                if (ui.ref)
                    this.uiRefs[ui.ref] = ui;
            },
        ]);

        this.dependencies = [].concat(schema.dependencies || [], schema.grayDependencies || []);
        this.watchers = schema.watchers || [];
    }

    static merge(...schemas) {
        return schemas.reduce((schema1, schema2) => _merge(schema1, schema2));
    }

    /**
     *
     * @param {*} config
     * @param {*} handlers
     * 使用call(this, )
     * @TODO: 考虑要不要不用这种方式
     * @TODO: 考虑改成 walk
     */
    static handleUI(ui, handlers) {
        handlers.forEach((handle) => handle.call(this, ui));
        ui.children && ui.children.forEach((child) => child && VueSchema.handleUI.call(this, child, handlers));
    }
}

export default VueSchema;
