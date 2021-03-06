// 解决window上挂自定义属性的问题
declare var window: Window & { backend: any }

import at from 'lodash/at';
import UINode from './UINode';

/**
 *
 * @param {*} condition
 * 数组为或，对象为与，不允许有函数
 */
const resolveCondition = (condition: any, context: { [key: string]: any }): any => {
    if (Array.isArray(condition))
        return condition.some((cond) => resolveCondition(cond, context));
    else if (typeof condition === 'object')
        return Object.keys(condition).every((key) => {
            if (key[0] === '!')
                return at(context, key.slice(1))[0] !== condition[key];
            else
                return at(context, key)[0] === condition[key];
        });
    else
        return !!condition;
};

class VueSchema {
    version: string;
    model: { [key: string]: any };
    uiSchema: UINode;
    dependencies: any[];
    watchers: any[];
    _uiRefs: any;
    uiRefs: any;

    constructor (schema) {
        this.version = schema.version;

        const model = schema.model || {};
        Object.keys(model).forEach((key) => {
            // json 里面只能用 null，这里统一视为 undefined
            if (model[key] === null)
                model[key] = undefined;
        });
        this.model = model;

        this.uiSchema = schema.uiSchema && new UINode(schema.uiSchema);
        this._uiRefs = schema.uiRefs;
        this.uiRefs = {};
        this.uiSchema && this.uiSchema.walk([
            (ui) => ui.ref && (this.uiRefs[ui.ref] = ui)
        ]);

        this.dependencies = [].concat(schema.dependencies || [], schema.grayDependencies || []);
        this.watchers = schema.watchers || [];
    }

    merge (schema) {
        Object.assign(this.model, schema.model);
        this.dependencies = this.dependencies.concat(schema.dependencies);
        this.watchers = this.watchers.concat(schema.watchers);

        if (schema.uiSchema)
            this.uiSchema.merge(schema.uiSchema);

        if (schema._uiRefs)
            Object.keys(schema._uiRefs).forEach((key) => {
                let uiNode = schema._uiRefs[key];
                // 强制删除
                if (uiNode === false) {
                    uiNode = { exist: false };
                    this.dependencies.forEach((dep, index) => dep.$ref === key && this.dependencies.splice(index, 1));
                }

                if (!this.uiRefs[key])
                    console.warn(`[WARNING] Cannot find '${key}' in uiRefs when merging.`);
                else
                    this.uiRefs[key].merge(new UINode(uiNode));
            });

        this.uiSchema && this.uiSchema.walk([
            (ui) => ui.ref && (this.uiRefs[ui.ref] = ui)
        ]);

        return this;
    }

    /**
     * 初始化组件
     * @param {*} options.handlers 初始化的都比较优先
     * @param {*} options.watchers 初始化的都比较优先
     * @param {*} context 上下文，一般为组件实例 this
     */
    initialize (options: any = {}, context: any) {
        // 必须先放，因为处理handlers的时候要获取里面的数据
        context.model = this.model;

        // 处理handles
        options.handlers && this.uiSchema.walk(options.handlers, context);

        // 转换dependencies
        // @DONE: 考虑将bindings转换为watch的形式
        this.dependencies.forEach((dep) => {
            // @DONE: 有两种类型的dep
            // @DONE: 支持$path查找路径

            if (!(dep.$ref || dep.$path))
                return console.warn('依赖没有$ref或$path属性', dep);

            let binding;
            if (dep.depend) {
                binding = () => resolveCondition(dep.depend, Object.assign({
                    this: context,
                    schema: this,
                    gray: window.backend ? window.backend.grayDeploy : {}
                }, context));
            } else if (dep.if) {
                binding = () => resolveCondition(dep.if.condition, Object.assign({
                    this: context,
                    schema: this,
                    gray: window.backend ? window.backend.grayDeploy : {}
                }, context)) ? dep.if.then : dep.if.else;
            }

            const ui = dep.$path ? at(this.uiSchema, dep.$path)[0] : at(this.uiRefs, dep.$ref)[0];
            if (!ui)
                return console.warn('找不到对应的依赖路径', dep);

            if (dep.prop || dep.attr)
                ui.bindingAttrs[dep.prop || dep.attr] = binding;
            if (dep.text)
                ui.bindingText = binding;
        });

        // binding的属性处理要在observe之前完成
        let watchers = [];
        this.uiSchema.walk([
            // 添加watchers，watcher比直接在render中算一遍性能好
            function (ui) {
                // 保证这两种属性的添加，要observe才能生效
                if (ui.attrs.disabled === undefined)
                    ui.attrs.disabled = undefined;
                if (ui.attrs.exist === undefined)
                    ui.attrs.exist = undefined;
                if (ui.attrs.hidden === undefined)
                    ui.attrs.hidden = undefined;
                if (ui.text === undefined)
                    ui.text = undefined;

                Object.keys(ui.bindingAttrs).forEach((attr) => {
                    if (ui.attrs[attr] === undefined)
                        ui.attrs[attr] = undefined;
                    let binding = ui.bindingAttrs[attr];
                    if (typeof binding === 'string') {
                        binding = Function('schema', 'gray', `with (this) { return ${binding} }`)
                            .bind(context, this, window.backend ? window.backend.grayDeploy : {});
                    }
                    watchers.push([
                        binding,
                        (value) => ui.attrs[attr] = value,
                    ]);
                });

                if (ui.bindingText) {
                    let binding = ui.bindingText;
                    if (typeof binding === 'string') {
                        binding = Function('schema', 'gray', `with (this) { return ${binding} }`)
                            .bind(context, this, window.backend ? window.backend.grayDeploy : {});
                    }
                    console.log(binding);
                    watchers.push([
                        binding,
                        (value) => ui.text = value,
                    ]);
                }
            },
        ], context);

        context.uiSchema = this.uiSchema;
        context.uiRefs = this.uiRefs;

        watchers = [].concat(options.watchers || [], watchers, this.watchers);
        watchers.forEach((watcher) => context.$watch(watcher[0], watcher[1], { immediate: true }));
    }
}

export default VueSchema;
