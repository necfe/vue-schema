import VueSchema from 'vue-schema';
import SchemaBase from 'vue-schema/src/schema-base.vue';

export default {
    extends: SchemaBase,
    created() {
        // vueSchema.normalize('');
        this.uiSchema = new VueSchema({
            uiSchema: {
                tag: 'u-button',
                text: 'abc',
            },
        }).uiSchema;

        console.log(this.uiSchema);
    },
};
