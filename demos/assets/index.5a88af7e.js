import { u as useRouter, r as react, t as toLocation, a as jsx, c as createHref, b as commit, d as resolve, e as reactDom, j as jsxs, f as useData } from './index.3fbfe50f.js';

const Context = /*#__PURE__*/react.exports.createContext({
  loading: false
});

/**
 * Get the prefetch context. Use for render a preview view.
 * @group Hooks
 */
function usePrefetch() {
  return react.exports.useContext(Context);
}

/**
 * Link support hover prefetch.
 * @param props
 * @group Components
 */
function PrefetchLink({
  to,
  children,
  ...rest
}) {
  const router = useRouter();
  const viewPromiseRef = react.exports.useRef();
  const [loading, setLoading] = react.exports.useState(false);
  const [error, setError] = react.exports.useState();
  const [view, setView] = react.exports.useState();
  const location = toLocation(router, to);
  function prefetchIt() {
    setLoading(true);
    viewPromiseRef.current = resolve(router, location).then(v => {
      setView(v);
      return v;
    }).catch(e => {
      setError(e);
      throw e;
    }).finally(() => setLoading(false));
  }
  function handlePrefetch() {
    if (viewPromiseRef.current) return;
    prefetchIt();
  }
  function handleClick(e) {
    e.preventDefault();
    if (!viewPromiseRef.current) {
      prefetchIt();
    }
    commit(router, viewPromiseRef.current, location);
  }
  react.exports.useEffect(() => {
    viewPromiseRef.current = undefined;
  }, [to]);
  return /*#__PURE__*/jsx(Context.Provider, {
    value: {
      loading,
      error,
      view
    },
    children: /*#__PURE__*/jsx("a", {
      ...rest,
      href: createHref(router, to),
      onMouseEnter: handlePrefetch,
      onClick: handleClick,
      children: children
    })
  });
}

var Popover_1paj6c5 = '';

function Popover({
  children
}) {
  const el = react.exports.useMemo(() => document.createElement('div'), []);
  react.exports.useEffect(() => {
    document.body.appendChild(el);
    return () => {
      el.parentElement?.removeChild(el);
    };
  }, []);
  return /*#__PURE__*/reactDom.exports.createPortal( /*#__PURE__*/jsx("div", {
    className: "d5lyyj6",
    children: children
  }), el);
}

function Preview({
  visible
}) {
  const {
    view,
    loading,
    error
  } = usePrefetch();
  if (!visible) return null;
  if (loading) return /*#__PURE__*/jsx(Popover, {
    children: "loading"
  });
  if (error) return /*#__PURE__*/jsx(Popover, {
    children: "error"
  });
  if (view) return /*#__PURE__*/jsx(Popover, {
    children: view
  });
  return null;
}

function PreviewLink({
  children,
  ...props
}) {
  const [visible, setVisible] = react.exports.useState(false);
  return /*#__PURE__*/jsxs(PrefetchLink, {
    ...props,
    children: [/*#__PURE__*/jsx("span", {
      onMouseEnter: () => setVisible(true),
      onMouseLeave: () => setVisible(false),
      children: children
    }), /*#__PURE__*/jsx(Preview, {
      visible: visible
    })]
  });
}

var index_1n9y0og = '';

function UserList() {
  const users = useData();
  return /*#__PURE__*/jsxs("div", {
    children: [/*#__PURE__*/jsx("h1", {
      className: "h6hbkzb",
      children: "User List"
    }), /*#__PURE__*/jsxs("ul", {
      children: [users.map(user => /*#__PURE__*/jsx("li", {
        children: /*#__PURE__*/jsx(PreviewLink, {
          to: `/users/${user.id}`,
          children: user.username
        })
      }, user.id)), /*#__PURE__*/jsx("li", {
        children: /*#__PURE__*/jsx(PreviewLink, {
          to: "/users/3",
          "data-testid": "lost",
          children: "user 3(lost)"
        })
      })]
    })]
  });
}

export { UserList as default };
