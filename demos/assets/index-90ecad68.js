import{u as b,r as n,t as w,j as e,c as L,a as k,b as y,d as g,e as M}from"./index-b8b3f27c.js";const m=n.createContext({loading:!1});function R(){return n.useContext(m)}function S({to:r,children:t,...o}){const s=b(),c=n.useRef(),[a,l]=n.useState(!1),[d,v]=n.useState(),[f,p]=n.useState(),h=w(s,r);function x(){l(!0),c.current=y(s,h).then(i=>(p(i),i)).catch(i=>{throw v(i),i}).finally(()=>l(!1))}function E(){c.current||x()}function P(i){i.preventDefault(),c.current||x(),k(s,c.current,h).finally(()=>c.current=void 0)}n.useEffect(()=>{c.current=void 0},[r,s]);const C=n.useMemo(()=>({loading:a,error:d,view:f}),[a,d,f]);return e.jsx(m.Provider,{value:C,children:e.jsx("a",{...o,href:L(s,r),onMouseEnter:E,onClick:P,children:t})})}function u({children:r}){const t=n.useMemo(()=>document.createElement("div"),[]);return n.useEffect(()=>(document.body.appendChild(t),()=>{var o;(o=t.parentElement)==null||o.removeChild(t)}),[]),g.createPortal(e.jsx("div",{className:"c5lyyj6",children:r}),t)}function D({visible:r}){const{view:t,loading:o,error:s}=R();return r?o?e.jsx(u,{children:"loading"}):s?e.jsx(u,{children:"error"}):t?e.jsx(u,{children:t}):null:null}function j({children:r,...t}){const[o,s]=n.useState(!1);return e.jsxs(S,{...t,children:[e.jsx("span",{onMouseEnter:()=>s(!0),onMouseLeave:()=>s(!1),children:r}),e.jsx(D,{visible:o})]})}function U(){const r=M();return e.jsxs("div",{children:[e.jsx("h1",{className:"c6hbkzb",children:"User List"}),e.jsxs("ul",{children:[r.map(t=>e.jsx("li",{children:e.jsx(j,{to:`/users/${t.id}`,children:t.username})},t.id)),e.jsx("li",{children:e.jsx(j,{to:"/users/3","data-testid":"lost",children:"user 3(lost)"})})]})]})}export{U as default};
