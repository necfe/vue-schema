import VueSchema from '../../../../dist/vue-schema';
import SchemaBase from 'vue-schema/src/base.vue';
import data from './side.json';

export default {
    extends: SchemaBase,
    created() {
        const schema = new VueSchema(data);
        schema.initialize({}, this);
    },
};
