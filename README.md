# VueSchema

VueSchema 是一种可以用 JSON 或 JS Object 来表示 Vue 组件的规范。

## 特色

- 将一份 Schema 数据渲染成页面中的组件
- 根据`exist`和`hidden`控制显隐藏。`exist`等效于`v-if`，对组件有创建销毁的特性；`hidden`等效于`v-show`，只控制`display`是否为`none`
- 动态绑定属性
- 使用依赖项控制联动
- Schema 数据无限合并
- [ ] JSON 能够完整表示 Vue 的相关功能
- [ ] JSON 与 Vue template 的互相转换工具

<!-- ，`exist`属性类似`v-if` -->

## 指南

### VueSchema

``` js
class VueSchema {
    version: string;            // 当前配置所使用的规范版本
    model: Object;              // 表单中的字段，通常在表单页面中使用。内部的属性会被双向绑定
    uiSchema: UINode;           // UISchema，它表示整个组件的结构，可以取代 Vue template。由 UINode 类型递归表示
    dependencies: Array;        // 组件间的依赖关系
    grayDependencies: Array;    // 使用灰测的依赖关系，与 dependencies 无异
    watchers: Array;            // Vue 的 watchers
}
```

### UINode

``` js
class UINode {
    tag: string;                // 节点的 tagName
    parent: UINode;             // 父节点
    children: Array<UINode>;    // 所有子节点
    child: UINode;              // 第一个子节点。为了方便
    text: string;               // 文本，如果没有子节点，则按文本渲染
    others: Object;             // 其它字段，用于保留自定义数据
    bindingAttrs: Object;       // 动态绑定属性
    bindingText: Function;      // 动态绑定文本

    // 以下为 Vue 渲染函数中 data 对象的字段
    // https://cn.vuejs.org/v2/guide/render-function.html#%E6%B7%B1%E5%85%A5-data-%E5%AF%B9%E8%B1%A1
    class: Object;
    style: Object;
    attrs: Object;              // 静态绑定属性
    props: Object;
    domProps: Object;
    on: Object;                 // 事件
    nativeOn: Object;
    directives: Array;
    scopedSlots: Object;
    slot: string;
    key: string;
    ref: string;                // 关联名。根据它 Vue 会在 this.$refs 会引用渲染后的实例，VueSchema 会在 uiRefs 引用此节点
}
```

#### 正规化

在 new UINode 时，可以使用配置的简化形式，UINode 会自动正规化。如：

``` js
{
    tag: 'u-button',
    color: 'primary',
    ':disabled': () => this.canSubmit,
    ':text': () => this.create ? '立即创建' : '设置',
}
```

会转换为

``` js
{
    tag: 'u-button',
    attrs: {
        color: 'primary',
    },
    bindingAttrs: {
        disabled: () => this.canSubmit,
    },
    bindingText: () => this.create ? '立即创建' : '设置'
}
```

所有未知的静态属性都会移入`attrs`，所有未知的动态属性都会移入`bindingAttrs`。因为设置组件时，属性不能出现 UINode 中所有的保留字。

#### 自动猜测子组件

如果没有传`tag`属性，则会根据父组件的名称猜测子组件。

``` json
{
    "tag": "u-radios",
    "children": [
        { "text": "直接创建", "value": "normal" },
        { "text": "从快照创建", "value": "snapshot" }
    ]
}
{
    "tag": "u-select",
    "children": [
        { "text": "面向容器服务", "value": "NCS" },
        { "text": "面向云服务器", "value": "NVM" }
    ]
}
```

会自动猜测为

``` json
{
    "tag": "u-radios",
    "children": [
        { "tag": "u-radio", "text": "直接创建", "value": "normal" },
        { "tag": "u-radio", "text": "从快照创建", "value": "snapshot" }
    ]
}
{
    "tag": "u-select",
    "children": [
        { "tag": "u-select-item", "text": "面向容器服务", "value": "NCS" },
        { "tag": "u-select-item", "text": "面向云服务器", "value": "NVM" }
    ]
}
```

### 动态绑定属性

这个功能类似于 Vue Template 中的`v-bind:attr`，只需属性名前加个冒号，值为一个函数。

``` js
{
    ':disabled': () => this.canSubmit
}
```

v0.4.0 之后，支持字符串表达式，这样在 JSON 中也可以方便地使用。

``` json
":disabled": "this.canSubmit"
```

类似 Vue Template，this 也可以省略。


### 依赖项控制联动

在配置中设置依赖项，很容易就能实现组件间的联动效果。目前依赖项 Dep 有两种。

#### depend

depend 字段为 Condition 类型，根据它 resolve 的布尔结果，直接赋值给需要控制 UINode 的属性。

这个经常用于一些布尔属性，比如控制组件的显隐、禁用等等。

``` json
{
    "$ref": "snapshot",                 // 需要控制 的 UINode 引用名
    "prop": "exist",                    // 需要控制的属性
    "depend": {                         // 依赖于。Condition 类型
        "model.createType": "snapshot"
    }
}
```

#### if

if 字段中的 condition 为 Condition 类型，根据它 resolve 的结果，判断给需要控制 UINode 的属性赋值 `then` 还是 `else`。

``` json
{
    "$ref": "InternetMaxBandwidth", "prop": "label", "if": {
        "condition": { "model.NetworkChargeType": "BANDWIDTH" },
        "then": "公网带宽",
        "else": "最大公网带宽"
    }
}
```

#### Condition 类型

Condition 类型用于表示复合型的布尔计算。

- 当它为一个对象时，结果按照对象中的各值进行“与”运算
- 当它为一个数组时，结果按照数组中的各值进行“或”运算
- 当它为一个简单类型时，结果直接将它转换为布尔值
- 对象中的键是一个 JSON 路径，如：`gray.nbsvolumeLabels['cn-east-1a']`。上下文支持：`schema`（当前配置）、`gray`（灰测对象）、`this`（Vue 实例）以及`this`中的所有属性。
- 如果这个键开头加`!`，则会对结果进行“非”运算

下面为一个复杂的例子：

``` json
[{
    "model.createType": "snapshot"
}, {
    "this.model.azName": "cn-east-1a",
    "!gray.nbsvolumeLabels['cn-east-1a']": 1
}]
```

### Watchers

每个 watcher 结构很简单，为一个数组，它直接表示 Vue 的 `$watch` 待传入的各个参数。如：

``` js
['model.createType', (createType) => {
    if (createType === 'normal')
        this.model.volume = 10;
}],
[() => [this.model.createType, this.model.format], () => {
    this.getSnapshotList();
}],
```

其实上述的动态绑定属性与依赖项控制联动都会转换为 watcher 的形式。

### 无限合并

使用`schema.merge(schema2)`，可以合并另一份数据。`schema2`只需为`schema`的部分数据即可。

uiSchema 的合并有两种方式。

#### 根据 uiSchema

#### 根据 uiRefs

## 构建

``` shell
npm run build
```

## 开发

``` shell
cd demo
vusion dev
```
