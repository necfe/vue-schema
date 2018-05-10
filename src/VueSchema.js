import at from 'lodash/at';
import UINode from './UINode';

/**
 *
 * @param {*} condition
 * 数组为或，对象为与，不允许有函数
 */
const resolveCondition = (condition, context) => {
    if (Array.isArray(condition))
        return condition.some((cond) => resolveCondition(cond, context));
    else if (typeof condition === 'object') {
        return Object.keys(condition).every((key) => {
            if (key[0] === '!')
                return at(context, key.slice(1))[0] !== condition[key];
            else
                return at(context, key)[0] === condition[key];
        });
    } else
        return !!condition;
};

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
        this._uiRefs = schema.uiRefs;
        this.uiRefs = {};
        this.uiSchema && this.uiSchema.walk([
            (ui) => {
                if (ui.ref)
                    this.uiRefs[ui.ref] = ui;
            },
        ]);

        this.dependencies = [].concat(schema.dependencies || [], schema.grayDependencies || []);
        this.watchers = schema.watchers || [];
    }

    merge(schema) {
        Object.assign(this.model, schema.model);
        this.dependencies = this.dependencies.concat(schema.dependencies);
        this.watchers = this.watchers.concat(schema.watchers);

        if (schema.uiSchema)
            this.uiSchema.merge(schema.uiSchema);

        if (schema._uiRefs) {
            Object.keys(schema._uiRefs).forEach((key) => {
                this.uiRefs[key].merge(new UINode(schema._uiRefs[key]));
            });
        }

        this.uiSchema && this.uiSchema.walk([
            (ui) => {
                if (ui.ref)
                    this.uiRefs[ui.ref] = ui;
            },
        ]);

        return this;
    }

    /**
     * 初始化组件
     * @param {*} options.handlers 初始化的都比较优先
     * @param {*} options.watchers 初始化的都比较优先
     * @param {*} context 上下文，一般为组件实例 this
     */
    initialize(options = {}, context) {
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
                binding = () => resolveCondition(dep.depend, {
                    model: context.model,
                    gray: window.backend ? window.backend.grayDeploy : {},
                });
            } else if (dep.if) {
                binding = () => resolveCondition(dep.if.condition, {
                    model: context.model,
                    gray: window.backend ? window.backend.grayDeploy : {},
                }) ? dep.if.then : dep.if.else;
            }

            const ui = dep.$path ? at(this.uiSchema, dep.$path)[0] : at(this.uiRefs, dep.$ref)[0];
            if (!ui)
                return console.warn('找不到对应的依赖路径', dep);

            ui.bindingAttrs[dep.prop] = binding;
            // this.watchers.push([
            //     binding,
            //     (value) => {
            //         ui.attrs[dep.prop] = value;
            //     },
            // ]);
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
                    watchers.push([
                        ui.bindingAttrs[attr],
                        (value) => ui.attrs[attr] = value,
                    ]);
                });

                ui.bindingText && watchers.push([
                    ui.bindingText,
                    (value) => ui.text = value,
                ]);
            },
        ], context);

        context.uiSchema = this.uiSchema;
        context.uiRefs = this.uiRefs;

        watchers = [].concat(options.watchers || [], watchers, this.watchers);
        watchers.forEach((watcher) => context.$watch(watcher[0], watcher[1], { immediate: true }));
    }
}

export default VueSchema;
