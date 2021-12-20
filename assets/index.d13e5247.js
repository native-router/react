import{u as g,j as i,a as o,V as v}from"./index.f1c686ef.js";import{e as c}from"./vendor.7f426df2.js";var y=["to"];function u(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(l){return Object.getOwnPropertyDescriptor(e,l).enumerable})),n.push.apply(n,r)}return n}function h(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?u(Object(n),!0).forEach(function(r){P(e,r,n[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):u(Object(n)).forEach(function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(n,r))})}return e}function P(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function w(e,t){if(e==null)return{};var n=x(e,t),r,l;if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(l=0;l<a.length;l++)r=a[l],!(t.indexOf(r)>=0)&&(!Object.prototype.propertyIsEnumerable.call(e,r)||(n[r]=e[r]))}return n}function x(e,t){if(e==null)return{};var n={},r=Object.keys(e),l,a;for(a=0;a<r.length;a++)l=r[a],!(t.indexOf(l)>=0)&&(n[l]=e[l]);return n}function f(e){var t=e.to,n=w(e,y),r=g(),l=r.navigate,a=r.createHref;function m(j){j.preventDefault(),l(t)}return i("a",h(h({},n),{},{href:a(t),onClick:m}))}var d,p,b,O;function s(e,t){return t||(t=e.slice(0)),Object.freeze(Object.defineProperties(e,{raw:{value:Object.freeze(t)}}))}function k(){return o("section",{className:c(d||(d=s([`
        display: flex;
        height: 100vh;
        align-items: stretch;

        & > * {
          overflow: auto;
        }
      `]))),children:[o("nav",{className:c(p||(p=s([`
          width: 200px;
          flex: none;
          border-right: 1px dashed;
        `]))),children:[o("ul",{children:[i("li",{children:i(f,{to:"/",children:"Home"})}),i("li",{children:i(f,{to:"/users",children:"Users"})}),i("li",{children:i(f,{to:"/help",children:"Help"})}),i("li",{children:i(f,{to:"/about",children:"About"})})]}),"modes",o("ul",{children:[i("li",{children:i("a",{href:"/demos/",children:"history"})}),i("li",{children:i("a",{href:"/demos/?hash",children:"hash"})}),i("li",{children:i("a",{href:"/demos/?memory",children:"memory"})})]})]}),i("main",{className:c(b||(b=s([`
          flex: auto;
        `]))),children:i(v,{})})]})}var H=c(O||(O=s([`
  :global() {
    body {
      margin: 0;
    }
  }
`])));export{k as default,H as globals};
