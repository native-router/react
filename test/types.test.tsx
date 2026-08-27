/**
 * Type-level tests for `RoutePaths` / `createRoutes` / `TypedLink`
 * (任务 1：类型安全的 Link to)。
 *
 * 本文件由 vitest `typecheck.include` 以 `tsc --noEmit` 收集（源码见
 * vitest.config.ts），断言全在类型层：`@ts-expect-error` 处期望编译
 * 错误出现，多余或缺失的 props 期望被 union 判别拒绝。运行时行为在
 * test/integration.test.tsx 的 `TypedLink` describe 中覆盖。
 *
 * 归并建议：后续路由表类型工具的用例继续追加到本文件。
 */
import {createRef, forwardRef} from 'react';
import type {AnchorHTMLAttributes, ComponentProps} from 'react';
import {describe, expectTypeOf, it} from 'vitest';
import {
  Link,
  MemoryRouter,
  NavLink,
  PrefetchLink,
  TypedLink,
  View,
  createRoutes
} from '../src/index';
import type {
  LinkProps,
  NavLinkProps,
  Route,
  RoutePaths,
  TypedLinkProps
} from '../src/types';

function Page() {
  return <div>Page</div>;
}

describe('RoutePaths', () => {
  it('should collect literal patterns from a nested table created with createRoutes', () => {
    const routes = createRoutes({
      component: () => Page,
      children: [
        {path: '/', component: () => Page},
        {
          path: '/users',
          component: () => Page,
          children: [{path: '/:id', component: () => Page}]
        },
        {path: '/article/:title', component: () => Page}
      ]
    });
    // The table is a type-level fixture; reference it at runtime so the
    // binding is not "only used as a type".
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<
      '/' | '/users/:id' | '/article/:title'
    >();
  });

  it('should pass children patterns through a layout level without path', () => {
    const routes = createRoutes({
      component: () => Page,
      children: [{path: '/help', component: () => Page}]
    });
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<'/help'>();
  });

  it('should collect from an array table and keep wildcard params', () => {
    const routes = createRoutes([
      {path: '/', component: () => Page},
      {path: '/files/*rest', component: () => Page}
    ]);
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<
      '/' | '/files/*rest'
    >();
  });

  it('should degrade to string when the table is asserted with `as Route`', () => {
    const routes = {
      children: [{path: '/users', component: () => Page}]
    } as Route;
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<string>();
  });
});

describe('TypedLink', () => {
  const routes = createRoutes({
    children: [
      {path: '/', component: () => Page},
      {path: '/users/:id', component: () => Page},
      {path: '/files/*rest', component: () => Page}
    ]
  });
  type Paths = RoutePaths<typeof routes>;

  it('should accept a table pattern and require its params', () => {
    expectTypeOf<Paths>().toEqualTypeOf<'/' | '/users/:id' | '/files/*rest'>();

    const app = (
      <MemoryRouter routes={routes}>
        <TypedLink<Paths> to="/" />
        <TypedLink<Paths> to="/users/:id" params={{id: '7'}} />
        <TypedLink<Paths> to="/files/*rest" params={{rest: ['a', 'b']}} />
        <View />
      </MemoryRouter>
    );
    expectTypeOf(app).not.toBeNever();
  });

  it('should reject a path outside the table', () => {
    <TypedLink<Paths>
      // @ts-expect-error '/help' is not a pattern of the table
      to="/help"
    />;
  });

  it('should reject a static pattern passed params', () => {
    <TypedLink<Paths>
      to="/"
      // @ts-expect-error static patterns take no params
      params={{id: '7'}}
    />;
  });

  it('should reject a missing or wrongly typed required param', () => {
    // @ts-expect-error params are required for '/users/:id'
    <TypedLink<Paths> to="/users/:id" />;
    <TypedLink<Paths>
      to="/users/:id"
      // @ts-expect-error id must be a string, not a number
      params={{id: 7}}
    />;
    <TypedLink<Paths>
      to="/files/*rest"
      // @ts-expect-error wildcard params are string arrays
      params={{rest: 'a'}}
    />;
  });
});

// A design-system-style link: own props + anchor attributes rest-spread,
// ref-forwarding — the shape `as` components are expected to have.
type PillProps = {
  variant: 'primary' | 'ghost';
  tone?: 'strong';
} & AnchorHTMLAttributes<HTMLAnchorElement>;

const PillLink = forwardRef<HTMLAnchorElement, PillProps>(
  function PillLink(props, ref) {
    // Children arrive through the rest spread.
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a ref={ref} data-testid="pill" {...props} />;
  }
);

// Not wrapped in forwardRef: must refuse a ref.
const PlainLink = (props: {variant: 'primary'}) => (
  <span data-variant={props.variant} />
);

// A link-family `as` component carrying its OWN `params` prop(UI libraries
// do this): the link's `params` — a key of only one member of the
// TypedLinkProps union — must own the key, the component's shape must not
// leak into the flattened region or asProps. Only referenced as a type
// here — the runtime shape is irrelevant to the type-level assertions.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ParamsPillLink = forwardRef<
  HTMLAnchorElement,
  PillProps & {params?: {x: number}}
>(function ParamsPillLink(props, ref) {
  // Children arrive through the rest spread.
  const anchorProps = props as AnchorHTMLAttributes<HTMLAnchorElement>;
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a ref={ref} {...anchorProps} />;
});

describe('Link family `as` polymorphism', () => {
  type Paths = '/' | '/users/:id';

  it('should flatten the as component non-conflicting props', () => {
    const el = (
      <Link as={PillLink} to="/users" variant="primary" tone="strong" />
    );
    expectTypeOf(el).not.toBeNever();
  });

  it('should require the as component required props and check values', () => {
    // @ts-expect-error variant is required by PillLink
    <Link as={PillLink} to="/users" />;
    <Link as={PillLink} to="/users" variant="ghost" />;
    // @ts-expect-error 'nope' is not a PillLink variant
    <Link as={PillLink} to="/users" variant="nope" />;
  });

  it('should restrict asProps to the keys shared with the base props', () => {
    <Link
      as={PillLink}
      to="/users"
      variant="primary"
      asProps={{target: '_blank'}}
    />;
    // The managed keys are rejected even though they are shared: href,
    // onClick and aria-current are always the link's own injections.
    // @ts-expect-error href is managed by the link, not settable via asProps
    <Link as={PillLink} to="/users" variant="primary" asProps={{href: '/x'}} />;
    // @ts-expect-error tone is not shared with the base props
    <Link
      as={PillLink}
      to="/users"
      variant="primary"
      asProps={{tone: 'strong'}}
    />;
    // @ts-expect-error target must stay a valid anchor target
    <Link as={PillLink} to="/users" variant="primary" asProps={{target: 1}} />;
  });

  it('should type the ref after the as component and refuse non-ref components', () => {
    const anchorRef = createRef<HTMLAnchorElement>();
    <Link as={PillLink} to="/users" variant="primary" ref={anchorRef} />;
    // @ts-expect-error PlainLink does not take a ref (no forwardRef)
    <Link as={PlainLink} to="/users" variant="primary" ref={anchorRef} />;
  });

  it('should accept as on NavLink and PrefetchLink', () => {
    <NavLink as={PillLink} to="/users" variant="primary" end />;
    <PrefetchLink
      as={PillLink}
      to="/users"
      variant="primary"
      prefetch="render"
    />;
  });

  it('should keep the TypedLink discriminated union under an as component', () => {
    <TypedLink<Paths, typeof PillLink>
      to="/users/:id"
      params={{id: '7'}}
      variant="primary"
    />;
    <TypedLink<Paths, typeof PillLink> to="/" variant="ghost" />;
    // @ts-expect-error params are still required for '/users/:id'
    <TypedLink<Paths, typeof PillLink> to="/users/:id" variant="primary" />;
    // @ts-expect-error a path outside the table is still rejected
    <TypedLink<Paths, typeof PillLink> to="/help" variant="primary" />;
    // Partial instantiation does not infer the remaining type argument
    // (the 'a' default would apply), so both must be given explicitly.
    // @ts-expect-error PillLink is not assignable to the defaulted 'a'
    <TypedLink<Paths> to="/users/:id" params={{id: '7'}} as={PillLink} />;
  });

  it('should let the link own params over an as component carrying its own', () => {
    // The link's params(the union member's pattern params) governs —
    // ParamsPillLink's own `{x?: number}` shape neither intersects nor
    // blocks the call.
    <TypedLink<Paths, typeof ParamsPillLink>
      to="/users/:id"
      params={{id: '7'}}
      variant="primary"
    />;
    // The link's params type is the only one checked: the component's
    // `x` is not a pattern param of '/users/:id'.
    <TypedLink<Paths, typeof ParamsPillLink>
      to="/users/:id"
      // @ts-expect-error x is ParamsPillLink's own param, not the pattern's
      params={{id: '7', x: 1}}
      variant="primary"
    />;
    // And there is no asProps route around the collision either.
    <TypedLink<Paths, typeof ParamsPillLink>
      to="/"
      variant="primary"
      // @ts-expect-error params is owned by the link, not settable via asProps
      asProps={{params: {x: 1}}}
    />;
  });
});

// 来源：原 test/component-props.test.tsx（本 patch 新建后按仓库测试组织
// 规范并入——纯类型断言属本文件既定范畴）。
describe('ComponentProps regression', () => {
  it('should keep ComponentProps readable and ref optional', () => {
    // Generic signatures collapse to their constraint when read
    // uninstantiated through ComponentProps; the plain tail overloads keep
    // the pre-`as` shapes (constructible without a ref).
    const linkProps: ComponentProps<typeof Link> = {to: '/x'};
    const navProps: ComponentProps<typeof NavLink> = {to: '/x'};
    const prefetchProps: ComponentProps<typeof PrefetchLink> = {to: '/x'};
    const typedProps: ComponentProps<typeof TypedLink> = {to: '/x'};
    expectTypeOf(linkProps).toExtend<LinkProps>();
    expectTypeOf(navProps).toExtend<NavLinkProps>();
    expectTypeOf(prefetchProps).toExtend<LinkProps>();
    expectTypeOf(typedProps).toExtend<TypedLinkProps>();
  });
});
