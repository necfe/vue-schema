import VueSchema from 'vue-schema';
import SchemaBase from 'vue-schema/src/schema-base.vue';
import data from '../../../../examples/dep.json';

export default {
    extends: SchemaBase,
    created() {
        const schema = new VueSchema(data);
        schema.initialize({
            handlers: [
                // <u-radio>和<u-checkbox>要使用label而不是value
                function (ui, context) {
                    if (ui.tag === 'u-radio' || ui.tag === 'u-checkbox')
                        ui.attrs.label = ui.attrs.value;
                },
                // 根据<u-form-item>的name属性给组件绑定v-model
                function (ui, context) {
                    let parent = ui.parent;
                    // @TODO: 有的时候有linear-layout...
                    if (parent && parent.tag === 'u-linear-layout' && parent.parent && parent.parent.tag === 'u-form-item' && parent.parent.attrs.name)
                        parent = parent.parent;

                    if (parent && parent.tag === 'u-form-item' && parent.attrs.name) {
                        const name = parent.attrs.name;
                        ui.bindingAttrs.value = () => context.model[name];
                        ui.on = ui.on || {};
                        ui.on.input = (value) => context.model[name] = value;
                    }
                },
            ],
        }, this);
    },
};
