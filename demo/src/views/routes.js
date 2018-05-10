import Index from './index.vue';
import Main from './main.vue';
import Simple from './simple.vue';
import Form from './form.vue';
import Exist from './exist.vue';
import Dep from './dep.vue';
import Merge from './merge.vue';

export default [
    { path: '/', component: Index, children: [
        { path: '', component: Main },
        { path: 'simple', component: Simple },
        // { path: 'overview', component: Overview },
        // { path: 'basic', component: Basic },
        { path: 'form', component: Form },
        { path: 'exist', component: Exist },
        { path: 'dep', component: Dep },
        { path: 'merge', component: Merge },
    ] },
];
