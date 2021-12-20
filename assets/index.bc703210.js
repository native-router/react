import{u as M,j as a,b as K,a as s}from"./index.f1c686ef.js";import{r as c,e as v}from"./vendor.7f426df2.js";var V=["to","children"];function _(e,r){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);r&&(n=n.filter(function(i){return Object.getOwnPropertyDescriptor(e,i).enumerable})),t.push.apply(t,n)}return t}function x(e){for(var r=1;r<arguments.length;r++){var t=arguments[r]!=null?arguments[r]:{};r%2?_(Object(t),!0).forEach(function(n){q(e,n,t[n])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):_(Object(t)).forEach(function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))})}return e}function q(e,r,t){return r in e?Object.defineProperty(e,r,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[r]=t,e}function b(e,r){return J(e)||G(e,r)||F(e,r)||B()}function B(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function F(e,r){if(!!e){if(typeof e=="string")return P(e,r);var t=Object.prototype.toString.call(e).slice(8,-1);if(t==="Object"&&e.constructor&&(t=e.constructor.name),t==="Map"||t==="Set")return Array.from(e);if(t==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t))return P(e,r)}}function P(e,r){(r==null||r>e.length)&&(r=e.length);for(var t=0,n=new Array(r);t<r;t++)n[t]=e[t];return n}function G(e,r){var t=e==null?null:typeof Symbol!="undefined"&&e[Symbol.iterator]||e["@@iterator"];if(t!=null){var n=[],i=!0,o=!1,f,u;try{for(t=t.call(e);!(i=(f=t.next()).done)&&(n.push(f.value),!(r&&n.length===r));i=!0);}catch(d){o=!0,u=d}finally{try{!i&&t.return!=null&&t.return()}finally{if(o)throw u}}return n}}function J(e){if(Array.isArray(e))return e}function Q(e,r){if(e==null)return{};var t=X(e,r),n,i;if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(i=0;i<o.length;i++)n=o[i],!(r.indexOf(n)>=0)&&(!Object.prototype.propertyIsEnumerable.call(e,n)||(t[n]=e[n]))}return t}function X(e,r){if(e==null)return{};var t={},n=Object.keys(e),i,o;for(o=0;o<n.length;o++)i=n[o],!(r.indexOf(i)>=0)&&(t[i]=e[i]);return t}var w=c.exports.createContext({loading:!1});function Y(){return c.exports.useContext(w)}function S(e){var r=e.to,t=e.children,n=Q(e,V),i=M(),o=i.prefetch,f=i.createHref,u=c.exports.useRef(),d=c.exports.useState(!1),O=b(d,2),T=O[0],p=O[1],C=c.exports.useState(),m=b(C,2),D=m[0],z=m[1],R=c.exports.useState(),g=b(R,2),H=g[0],N=g[1];function j(){p(!0);var l=o(r,{done:function(h){l===u.current&&(p(!1),N(h))},onError:function(h){l===u.current&&(p(!1),z(h))}});u.current=l}function U(){u.current||j()}function W(l){l.preventDefault(),u.current||j(),u.current()}return c.exports.useEffect(function(){u.current=void 0},[r]),a(w.Provider,{value:{loading:T,error:D,view:H},children:a("a",x(x({},n),{},{href:f(r),onMouseEnter:U,onClick:W,children:t}))})}var A,E;function L(e,r){return r||(r=e.slice(0)),Object.freeze(Object.defineProperties(e,{raw:{value:Object.freeze(r)}}))}function y(e){var r=e.children;return a("span",{className:v(A||(A=L([`
        display: none;
        position: relative;

        a:hover > & {
          display: initial;
        }
      `]))),children:a("div",{className:v(E||(E=L([`
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
        `]))),children:r})})}function k(){var e=Y(),r=e.view,t=e.loading,n=e.error;return t?a(y,{children:"loading"}):n?a(y,{children:"error"}):r?a(y,{children:r}):null}var I;function Z(e,r){return r||(r=e.slice(0)),Object.freeze(Object.defineProperties(e,{raw:{value:Object.freeze(r)}}))}function te(){var e=K();return s("div",{children:[a("h1",{className:v(I||(I=Z([`
          text-align: center;
        `]))),children:"User List"}),s("ul",{children:[e.map(function(r){return a("li",{children:s(S,{to:"/users/".concat(r.id),children:[r.username,a(k,{})]})},r.id)}),a("li",{children:s(S,{to:"/users/3","data-testid":"lost",children:["user 3(lost)",a(k,{})]})})]})]})}export{te as default};
