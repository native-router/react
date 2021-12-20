var v=Object.defineProperty,y=Object.defineProperties;var j=Object.getOwnPropertyDescriptors;var s=Object.getOwnPropertySymbols;var c=Object.prototype.hasOwnProperty,d=Object.prototype.propertyIsEnumerable;var t=(e,l,i)=>l in e?v(e,l,{enumerable:!0,configurable:!0,writable:!0,value:i}):e[l]=i,m=(e,l)=>{for(var i in l||(l={}))c.call(l,i)&&t(e,i,l[i]);if(s)for(var i of s(l))d.call(l,i)&&t(e,i,l[i]);return e},u=(e,l)=>y(e,j(l));var f=(e,l)=>{var i={};for(var n in e)c.call(e,n)&&l.indexOf(n)<0&&(i[n]=e[n]);if(e!=null&&s)for(var n of s(e))l.indexOf(n)<0&&d.call(e,n)&&(i[n]=e[n]);return i};import{e as a}from"./vendor.717894df.js";import{u as k,j as r,a as h,V as w}from"./index.c4323875.js";function o(i){var n=i,{to:e}=n,l=f(n,["to"]);const{navigate:p,createHref:x}=k();function g(b){b.preventDefault(),p(e)}return r("a",u(m({},l),{href:x(e),onClick:g}))}function L(){return h("section",{className:a`
        display: flex;
        height: 100vh;
        align-items: stretch;

        & > * {
          overflow: auto;
        }
      `,children:[h("nav",{className:a`
          width: 200px;
          flex: none;
          border-right: 1px dashed;
        `,children:[h("ul",{children:[r("li",{children:r(o,{to:"/",children:"Home"})}),r("li",{children:r(o,{to:"/users",children:"Users"})}),r("li",{children:r(o,{to:"/help",children:"Help"})}),r("li",{children:r(o,{to:"/about",children:"About"})})]}),"modes",h("ul",{children:[r("li",{children:r("a",{href:"/demos/",children:"history"})}),r("li",{children:r("a",{href:"/demos/?hash",children:"hash"})}),r("li",{children:r("a",{href:"/demos/?memory",children:"memory"})})]})]}),r("main",{className:a`
          flex: auto;
        `,children:r(w,{})})]})}const V=a`
  :global() {
    body {
      margin: 0;
    }
  }
`;export{L as default,V as globals};
