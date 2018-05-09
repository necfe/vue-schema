import at from 'lodash/at';

const VUE_RESERVED_WORDS = 'class,style,attrs,props,domProps,on,nativeOn,directives,scopedSlots,slot,key,ref'.split(',');
const SCHEMA_RESERVED_WORDS = 'tag,bindingAttrs,bindingText,parent,child,children,text,others'.split(',');

const guessChildName = (name) => {
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

class UINode {
    // tag: string;
    // parent: UINode;
    // child: UINode;
    // children: Array<UINode>;
    // text: string;
    // others: Object;
    // bindingAttrs: Object;
    // bindingText: Function;

    // class: string;
    // style: ;
    // attrs: ;
    // props,
    // domProps,
    // on,
    // nativeOn,
    // directives,
    // scopedSlots,
    // slot,
    // key,
    // ref

    constructor(ui, parent) {
        // @TODO: 先不处理自己处理自己的情况

        if (!ui.tag) {
            if (!parent)
                throw new Error('父组件为空，无法从父组件猜测子组件的名称！');
            this.tag = guessChildName(parent.tag);
        } else
            this.tag = ui.tag;

        this.parent = parent;
        this.text = ui.text;
        this.others = ui.others;

        // 将 Vue 的所有保留字段直接透过来
        VUE_RESERVED_WORDS.forEach((word) => this[word] = ui[word]);

        // 都用 attrs，props 只能使用在 JS 中声明过的，有一些属性单纯是样式扩充
        this.attrs = ui.attrs || {};
        this.bindingAttrs = ui.bindingAttrs || {};

        Object.keys(ui).forEach((key) => {
            if (!(VUE_RESERVED_WORDS.includes(key) || SCHEMA_RESERVED_WORDS.includes(key))) {
                if (key === ':text')
                    this.bindingText = ui[key];
                else if (key[0] === ':')
                    this.bindingAttrs[key.slice(1)] = ui[key];
                else
                    this.attrs[key] = ui[key];
            }
        });

        let children = ui.children || [];
        if (!ui.children && ui.child) {
            if (typeof ui.child === 'string')
                ui.child = { tag: ui.child };
            children = [ui.child];
        }

        this.children = children.map((child) => {
            if (!child)
                return undefined;
            else
                return new UINode(child, this);
        });
        this.child = this.children[0];
    }

    // get exist() {
    //     const exist = this.attrs.exist;
    //     return exist !== undefined && !!exist === false;
    // }

    // get hasChild() {
    //     return !!(this.children && this.children.length);
    // }
}

export default UINode;
