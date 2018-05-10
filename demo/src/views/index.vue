<template>
<div :class="$style.root">
    <aside :class="$style.side">
        <u-sidebar>
            <u-sidebar-item exact to="/">首页</u-sidebar-item>
            <u-sidebar-item exact to="/simple">简单示例</u-sidebar-item>
            <u-sidebar-item exact to="/form">表单示例</u-sidebar-item>
            <u-sidebar-item exact to="/exist">控制显隐</u-sidebar-item>
            <u-sidebar-item exact to="/dep">依赖联动</u-sidebar-item>
            <u-sidebar-item exact to="/merge">无限合并</u-sidebar-item>
        </u-sidebar>
    </aside>
    <main :class="$style.main">
        <router-view></router-view>
    </main>
</div>
</template>

<script>
export default {};
</script>

<style module>
html, body, :global(#app), .root {
    height: 100%;
}

.head {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    height: 68px;
    background: $brand-primary;
    color: white;
    box-shadow: 0 3px 4px rgba(0,0,0,0.1);
    padding: 0 10px;
    z-index: 1;
}

.wrap {
    width: 1180px;
    margin: 0 auto;
}

.side {
    float: left;
    width: 260px;
    height: 100%;
    background: #f0f6fa;
}

.main {
    margin-left: 260px;
    padding: 40px;
}
</style>
