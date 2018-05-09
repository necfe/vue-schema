import configService from './index';
import Bridge from '@/utils/Bridge';
import { cache } from '@/utils/cache';

import defaultsDeep from 'lodash/defaultsDeep';
import at from 'lodash/at';

// import sample from '../../ncv/services/config.json';

const vueReservedWords = 'class,style,attrs,props,domProps,on,nativeOn,directives,scopedSlots,slot,key,ref'.split(',');
const schemaReservedWords = 'tag,options,bindings,bindingAttrs,bindingText,parent,child,children,text,others'.split(',');

const getChildName = (name) => {
    if (name.endsWith('s'))
        return name.slice(0, -1);
    else if (name.endsWith('es'))
        return name.slice(0, -2);
    else
        return name + '-item';
};

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

const initialWatchers = [];
// 处理一些常见的样式问题，通用逻辑或固有缺陷
const initialHandlers = [
    // <u-form>默认使用大号gap
    function (ui, parent) {
        if (ui.tag === 'u-form')
            ui.options.attrs.gap = ui.options.attrs.gap || 'large';
    },
    // <u-input>默认使用最大号
    function (ui, parent) {
        if (ui.tag === 'u-input')
            ui.options.attrs.size = ui.options.attrs.size || 'huge';
    },
    // <u-radio>和<u-checkbox>要使用label而不是value
    function (ui, parent) {
        if (ui.tag === 'u-radio' || ui.tag === 'u-checkbox')
            ui.options.attrs.label = ui.options.attrs.value;
    },
    // <u-form-item>在有description时采用block布局（以后看要不要吸收到组件中）
    function (ui, parent) {
        if (ui.tag === 'u-form-item' && ui.options.attrs.description)
            ui.options.attrs.layout = 'block';
    },
    // 根据<u-form-item>的name属性给组件绑定v-model
    function (ui, parent) {
        // @TODO: 有的时候有linear-layout...
        if (parent && parent.tag === 'u-linear-layout' && parent.parent && parent.parent.tag === 'u-form-item' && parent.parent.options.attrs.name)
            parent = parent.parent;

        if (parent && parent.tag === 'u-form-item' && parent.options.attrs.name) {
            const name = parent.options.attrs.name;
            ui.bindings.attrs.value = () => this.model[name];
            ui.options.on = ui.options.on || {};
            ui.options.on.input = (value) => this.model[name] = value;
        }
    },
    // 给循环的元素添加key
    function (ui, parent) {
        const key = ui.options.attrs.name || ui.options.attrs.value;
        if (typeof key === 'string' || typeof key === 'number')
            ui.options.key = key;
    },
    // 自动添加product
    function (ui, parent) {
        if (ui.tag === 'u-charge-type-radios' || ui.tag === 'u-purchase-period-capsules')
            ui.options.attrs.product = ui.options.attrs.product || this.product;
    },
    // 禁用或者隐藏时，自动切换到第一个可选项
    function (ui, parent) {
        if (ui.tag === 'u-radio' || ui.tag === 'u-capsule') {
            initialWatchers.push([
                () => (ui.options.attrs.disabled === true || ui.options.attrs.exist === false)
                    && parent.options.attrs.value === ui.options.attrs.value,
                (value) => value
                    && (this.model[parent.parent.options.attrs.name] = parent.child.options.attrs.value),
            ]);
        }
    },
];

const service = {
    get(params) {
        params = {
            service: params.product,
            cloudType: window.backend.distributorName,
            region: window.backend.regionId,
            operateType: 'create',
            version: params.version,
        };
        const key = [params.service, params.operateType, params.version].join('-');

        const request = configService.pageConfig({
            query: params,
        }).then(({ result }) => {
            if (!result) {
                console.error('找不到配置文件！', params);
                throw new Error('找不到配置文件！');
            }

            result = typeof result === 'object' ? result : JSON.parse(result); // return object
            if (result.version < '0.2.0')
                throw new Error('配置版本不正确');

            cache.add(key, JSON.stringify(result));
            return result;
        }).catch(() => {
            Bridge.send('parent', 'error', '系统正忙，请稍后再试');
            Bridge.send('parent', 'urlchange', '/overview');
        });

        return cache.has(key) ? Promise.resolve(JSON.parse(cache.get(key))) : request;
    },
    normalize(config) {
        config.model = config.model || {};
        Object.keys(config.model).forEach((key) => {
            if (config.model[key] === null)
                config.model[key] = undefined;
        });

        config.uiSchema && service.normalizeUI(config.uiSchema);

        config.dependencies = config.dependencies || [];
        config.grayDependencies = config.grayDependencies || [];
        config.dependencies = config.dependencies.concat(config.grayDependencies);
        config.watchers = config.watchers || [];
        delete config.grayDependencies;

        return config;
    },
    normalizeUI(ui, parent) {
        // 先都放到attrs下了，有一些属性只是样式扩充
        ui.attrs = ui.attrs || {};
        ui.bindingAttrs = ui.bindingAttrs || {};
        Object.keys(ui).forEach((key) => {
            if (!(vueReservedWords.includes(key) || schemaReservedWords.includes(key))) {
                if (key === ':text')
                    ui.bindingText = ui[key];
                else if (key[0] === ':') {
                    const bindingKey = key.slice(1);
                    if (ui.bindingAttrs[bindingKey] === undefined)
                        ui.bindingAttrs[bindingKey] = ui[key];
                } else {
                    if (ui.attrs[key] === undefined)
                        ui.attrs[key] = ui[key];
                }
                delete ui[key];
            }
        });

        if (ui.child) {
            if (typeof ui.child === 'string')
                ui.child = { tag: ui.child };
            ui.children = [ui.child];
        }

        if (!ui.tag) {
            if (!parent)
                throw new Error('父组件为空，无法从父组件判断子组件的名称！');
            ui.tag = getChildName(parent.tag);
        }

        ui.options = ui.options || {};
        ui.bindings = ui.bindings || {};
        Object.keys(ui).forEach((key) => {
            if (!schemaReservedWords.includes(key)) {
                if (ui.options[key] === undefined)
                    ui.options[key] = ui[key];
                delete ui[key];
            } else if (key.startsWith('binding') && key !== 'bindings') {
                const bindingKey = key.slice(7).toLowerCase();
                if (ui.bindings[bindingKey] === undefined)
                    ui.bindings[bindingKey] = ui[key];
                delete ui[key];
            }
        });

        ui.children && ui.children.forEach((child) => {
            if (!child)
                return;

            child.parent = ui;
            service.normalizeUI(child, ui);
        });

        return ui;
    },
    merge(config1, config2) {
        const config = {};

        config.model = Object.assign({}, config1.model, config2.model);
        config.uiSchema = (config1.uiSchema && config2.uiSchema) ? service.mergeUI(config1.uiSchema, config2.uiSchema) : (config1.uiSchema || config2.uiSchema);
        config.dependencies = [].concat(config1.dependencies || [], config2.dependencies || []);
        config.watchers = [].concat(config1.watchers || [], config2.watchers || []);
        return config;
    },
    mergeUI(ui1, ui2) {
        const ui = {};

        ui.tag = ui2.tag || ui1.tag;
        ui.options = defaultsDeep({}, ui2.options, ui1.options);
        ui.bindings = defaultsDeep({}, ui2.bindings, ui1.bindings);
        ui.others = Object.assign({}, ui1.others, ui2.others);
        ui.text = ui2.text || ui1.text;

        ui.children = [];
        ui1.children = ui1.children || [];
        ui2.children = ui2.children || [];
        const maxLength = Math.max(ui1.children.length, ui2.children.length);

        for (let i = 0; i < maxLength; i++) {
            const child1 = ui1.children[i];
            const child2 = ui2.children[i];

            if (child1 && child2)
                ui.children[i] = service.mergeUI(child1, child2);
            else if (!child1 && !child2)
                ; // ignore
            else
                ui.children[i] = service.mergeUI({}, child2 || child1);

            if (ui.children[i])
                ui.children[i].parent = ui;
        }

        ui.child = ui.children[0];

        return ui;
    },
    /**
     *
     * @param {*} config
     * @param {*} handlers
     * 使用call(this, )
     */
    handleUI(ui, parent, handlers) {
        handlers.forEach((handle) => handle.call(this, ui, parent));
        ui.children && ui.children.forEach((child) => service.handleUI.call(this, child, ui, handlers));
    },
    /**
     * @param {*} remoteConfig
     * @param {*} extendConfig
     * 使用call(this, )
     */
    initialize(remoteConfig, extendConfig, handlers) {
        remoteConfig && service.normalize(remoteConfig);
        extendConfig && service.normalize(extendConfig);
        const config = (remoteConfig && extendConfig) ? service.merge(remoteConfig, extendConfig) : (remoteConfig || extendConfig);

        // 必须先放，因为处理handlers的时候要获取里面的数据
        this.model = config.model;

        // 处理handles
        config.uiRefs = {};
        service.handleUI.call(this, config.uiSchema, undefined, initialHandlers.concat([
            // 记录uiRefs
            function (ui) {
                if (ui.options.ref)
                    config.uiRefs[ui.options.ref] = ui;
            },
        ]));

        // 转换dependencies
        // @DONE: 考虑将bindings转换为watch的形式
        config.dependencies.forEach((dep) => {
            // @DONE: 有两种类型的dep
            // @DONE: 支持$path查找路径

            if (!(dep.$ref || dep.$path))
                return console.warn('依赖没有$ref或$path属性', dep);

            let binding;
            if (dep.depend) {
                binding = () => resolveCondition(dep.depend, {
                    model: this.model,
                    gray: window.backend.grayDeploy,
                });
            } else if (dep.if) {
                binding = () => resolveCondition(dep.if.condition, {
                    model: this.model,
                    gray: window.backend.grayDeploy,
                }) ? dep.if.then : dep.if.else;
            }

            const ui = dep.$path ? at(config.uiSchema, dep.$path)[0] : at(config.uiRefs, dep.$ref)[0];
            if (!ui)
                return console.warn('找不到对应的依赖路径', dep);

            ui.bindings.attrs[dep.prop] = binding;
            // config.watchers.push([
            //     binding,
            //     (value) => {
            //         ui.options.attrs[dep.prop] = value;
            //     },
            // ]);
        });

        // binding的属性处理要在observe之前完成
        let watchers = [];
        service.handleUI.call(this, config.uiSchema, undefined, [
            // 添加watchers，watcher比直接在render中算一遍性能好
            function (ui) {
                // 保证这两种属性的添加，要observe才能生效
                if (ui.options.attrs.disabled === undefined)
                    ui.options.attrs.disabled = undefined;
                if (ui.options.attrs.exist === undefined)
                    ui.options.attrs.exist = undefined;
                if (ui.options.attrs.hidden === undefined)
                    ui.options.attrs.hidden = undefined;
                if (ui.text === undefined)
                    ui.text = undefined;

                Object.keys(ui.bindings.attrs).forEach((attr) => {
                    if (ui.options.attrs[attr] === undefined)
                        ui.options.attrs[attr] = undefined;
                    watchers.push([
                        ui.bindings.attrs[attr],
                        (value) => ui.options.attrs[attr] = value,
                    ]);
                });

                ui.bindings.text && watchers.push([
                    ui.bindings.text,
                    (value) => ui.text = value,
                ]);
            },
        ].concat(handlers || []));

        this.uiSchema = config.uiSchema;
        this.uiRefs = config.uiRefs;

        watchers = initialWatchers.concat(watchers, config.watchers);
        watchers.forEach((watcher) => this.$watch(watcher[0], watcher[1], { immediate: true }));

        return config;
    },
    /**
     * @TODO....
     * @param {*} ui
     * @param {*} parent
     * @param {*} handlers
     */
    initializeUI(ui, parent, handlers) {
        const uiRefs = this.uiRefs;

        service.normalizeUI(ui, parent);
        service.handleUI.call(this, ui, parent, initialHandlers.concat([
            // 记录uiRefs
            function (ui) {
                if (ui.options.ref)
                    uiRefs[ui.options.ref] = ui;
            },
            // 如果children一直更换，则会重复绑定watch
            // function (ui) {
            //     Object.keys(ui.bindings.attrs).forEach((attr) => {
            //         config.watchers.push([
            //             ui.bindings.attrs[attr],
            //             (value) => {
            //                 ui.options.attrs[attr] = value
            //             },
            //         ]);
            //     });
            // },
        ], handlers || []));

        return ui;
    },
};

export default service;
