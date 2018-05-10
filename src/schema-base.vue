<script>
const VUE_RESERVED_WORDS = 'class,style,attrs,props,domProps,on,nativeOn,directives,scopedSlots,slot,key,ref'.split(',');

export default {
    data() {
        return {
            model: {},
            uiSchema: undefined,
            uiRefs: undefined,
        };
    },
    methods: {
        renderUI(h, ui) {
            // 在 render 函数中，尽量减少对 ui 的操作（如下的动态绑定属性），应该用 watch 取代
            // Object.keys(ui.bindingAttrs`).forEach((attr) => ui.attrs[attr] = ui.bindingAttrs[attr]());
            if (ui.attrs.exist !== undefined && !!ui.attrs.exist === false)
                return;

            // _options 会被 Vue 改掉，因此这个对象不能共用，每次必须重新创建
            const options = {};
            VUE_RESERVED_WORDS.forEach((word) => {
                if (Array.isArray(ui[word]))
                    options[word] = ui[word];
                // 必须要复制一次，不然会有问题
                else if (typeof ui[word] === 'object')
                    options[word] = Object.assign({}, ui[word]);
                else
                    options[word] = ui[word];
            });

            if (ui.attrs.hidden) {
                options.style = options.style || {};
                options.style.display = 'none';
            }

            return h(
                ui.tag,
                options,
                ui.children && ui.children.length ? ui.children.map((child) => this.renderUI(h, child)) : ui.text,
            );
        },
    },
    render(h) {
        if (!this.uiSchema)
            return h('div');
        else
            return this.renderUI(h, this.uiSchema);
    },
};
</script>
