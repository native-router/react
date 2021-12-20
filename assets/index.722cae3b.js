var H=Object.defineProperty,I=Object.defineProperties;var M=Object.getOwnPropertyDescriptors;var a=Object.getOwnPropertySymbols;var v=Object.prototype.hasOwnProperty,m=Object.prototype.propertyIsEnumerable;var g=(e,r,t)=>r in e?H(e,r,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[r]=t,w=(e,r)=>{for(var t in r||(r={}))v.call(r,t)&&g(e,t,r[t]);if(a)for(var t of a(r))m.call(r,t)&&g(e,t,r[t]);return e},P=(e,r)=>I(e,M(r));var b=(e,r)=>{var t={};for(var s in e)v.call(e,s)&&r.indexOf(s)<0&&(t[s]=e[s]);if(e!=null&&a)for(var s of a(e))r.indexOf(s)<0&&m.call(e,s)&&(t[s]=e[s]);return t};import{r as o,e as f}from"./vendor.717894df.js";import{u as V,j as n,b as $,a as u}from"./index.c4323875.js";const j=o.exports.createContext({loading:!1});function q(){return o.exports.useContext(j)}function C(s){var p=s,{to:e,children:r}=p,t=b(p,["to","children"]);const{prefetch:E,createHref:L}=V(),i=o.exports.useRef(),[N,l]=o.exports.useState(!1),[R,S]=o.exports.useState(),[y,D]=o.exports.useState();function x(){l(!0);const c=E(e,{done(d){c===i.current&&(l(!1),D(d))},onError(d){c===i.current&&(l(!1),S(d))}});i.current=c}function U(){i.current||x()}function z(c){c.preventDefault(),i.current||x(),i.current()}return o.exports.useEffect(()=>{i.current=void 0},[e]),n(j.Provider,{value:{loading:N,error:R,view:y},children:n("a",P(w({},t),{href:L(e),onMouseEnter:U,onClick:z,children:r}))})}function h({children:e}){return n("span",{className:f`
        display: none;
        position: relative;

        a:hover > & {
          display: initial;
        }
      `,children:n("div",{className:f`
          position: absolute;
          width: 300px;
          height: 200px;
          top: 0;
          left: 0;
          overflow: auto;
          z-index: 1000;
          border: solid 1px #ccc;
          border-radius: 4px;
          background: #fff;
          pointer-events: none;
        `,children:e})})}function k(){const{view:e,loading:r,error:t}=q();return r?n(h,{children:"loading"}):t?n(h,{children:"error"}):e?n(h,{children:e}):null}function G(){const e=$();return u("div",{children:[n("h1",{className:f`
          text-align: center;
        `,children:"User List"}),u("ul",{children:[e.map(r=>n("li",{children:u(C,{to:`/users/${r.id}`,children:[r.username,n(k,{})]})},r.id)),n("li",{children:u(C,{to:"/users/3","data-testid":"lost",children:["user 3(lost)",n(k,{})]})})]})]})}export{G as default};
