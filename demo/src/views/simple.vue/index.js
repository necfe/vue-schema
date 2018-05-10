import VueSchema from 'vue-schema';
import SchemaBase from 'vue-schema/src/schema-base.vue';
import data from '../../../../examples/simple.json';

export default {
    extends: SchemaBase,
    created() {
        this.uiSchema = new VueSchema(data).uiSchema;
    },
};