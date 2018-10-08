import at from 'lodash/at';
// import merge from 'lodash/merge'

const VUE_RESERVED_WORDS: Array<string> = 'class,style,attrs,props,domProps,on,nativeOn,directives,scopedSlots,slot,key,ref'.split(',');
const SCHEMA_RESERVED_WORDS: Array<string> = 'tag,bindingAttrs,bindingText,parent,child,children,text,others'.split(',');
const SIMPLE_WORDS: Array<string> = 'tag,text,bindingText,slot,key,ref'.split(',');
const OBJECT_WORDS: Array<string> = 'class,style,attrs,bindingAttrs,props,domProps,on,nativeOn,directives,scopedSlots,others'.split(',');
const ARRAY_WORDS: Array<string> = 'directives'.split(',');

const guessChildName = (name: string): string => {
    if (name.endsWith('s'))
        return name.slice(0, -1);
    else if (name.endsWith('es'))
        return name.slice(0, -2);
    else
        return name + '-item';
};

interface UINodeFace {
    tag: string;
    parent: UINodeFace | any;
    child: UINodeFace | any;
    children: Array<UINodeFace>;
    text: string;
    others: { [key: string]: any };
    bindingAttrs: { [key: string]: any };
    bindingText: Function;
    class: string;
    attrs: { [key: string]: any };
    merge (ui: any);
    walk (handlers: any[], context: any);
}

class UINode implements UINodeFace {
    tag: string;
    parent: UINodeFace | any;
    child: UINodeFace | any;
    children: Array<UINodeFace>;
    text: string;
    others: { [key: string]: any };
    bindingAttrs: { [key: string]: any };
    bindingText: Function;
    class: string;
    attrs: { [key: string]: any };
    constructor (ui: any, parent?: any) {
        // @TODO: 先不处理自己处理自己的情况

        if (!ui.tag && parent)
            this.tag = guessChildName(parent.tag);
        else
            this.tag = ui.tag;

        this.parent = parent;
        this.text = ui.text;
        this.others = ui.others;

        // 将 Vue 的所有保留字段直接透过来
        VUE_RESERVED_WORDS.forEach((word) => this[word] = ui[word]);

        // 都用 attrs，props 只能使用在 JS 中声明过的，有一些属性单纯是样式扩充
        this.attrs = ui.attrs || {};
        this.bindingAttrs = ui.bindingAttrs || {};
        this.bindingText = ui.bindingText;

        Object.keys(ui).forEach((key) => {
            if (!(VUE_RESERVED_WORDS.includes(key) || SCHEMA_RESERVED_WORDS.includes(key)))
                if (key === ':text')
                    this.bindingText = ui[key];
                else if (key[0] === ':')
                    this.bindingAttrs[key.slice(1)] = ui[key];
                else
                    this.attrs[key] = ui[key];
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
    //     const exist = this.attrs.exist
    //     return exist !== undefined && !!exist === false
    // }

    // get hasChild() {
    //     return !!(this.children && this.children.length)
    // }

    merge (ui: any) {
        // return merge(this, ui)
        // 允许后者将前者的tag直接覆盖
        SIMPLE_WORDS.forEach((word) => this[word] = ui[word] === undefined ? this[word] : ui[word]);
        OBJECT_WORDS.forEach((word) => this[word] = Object.assign({}, this[word], ui[word]));
        ARRAY_WORDS.forEach((word) => this[word] = [].concat(this[word] || [], ui[word] || []));

        // const uiNode = new UINode(ui, parent)

        const maxLength = Math.max(this.children.length, ui.children.length);

        for (let i = 0; i < maxLength; i++) {
            const child1 = this.children[i];
            const child2 = ui.children[i];

            if (child1 && child2)
                this.children[i] = child1.merge(child2);
            else if (!child1 && child2)
                this.children[i] = child2;

            this.children[i].parent = this;
        }
        this.child = this.children && this.children[0];

        return this;
    }

    walk (handlers: any[], context?: any) {
        handlers.forEach((handle) => handle(this, context));
        this.children && this.children.forEach((child) => child && child.walk(handlers, context));
    }
}

export default UINode;
