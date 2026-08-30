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
  TypedNavLink,
  TypedPrefetchLink,
  View,
  createRouter,
  createRoutes,
  useBlocker
} from '../src/index';
import type {
  LinkProps,
  NavLinkProps,
  Route,
  RoutePaths,
  RouteSearchInputOf,
  SearchInput,
  StandardSchemaV1,
  TypedLinkProps,
  TypedNavLinkProps
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

// 任务：TypedNavLink/TypedPrefetchLink —— NavLink/PrefetchLink 的 TypedLink
// 式判别联合（to 收窄 + params 按模式判别），as 组合在单类型实参下可用。
describe('TypedNavLink', () => {
  const routes = createRoutes({
    children: [
      {path: '/', component: () => Page},
      {path: '/users/:id', component: () => Page},
      {path: '/files/*rest', component: () => Page}
    ]
  });
  type Paths = RoutePaths<typeof routes>;

  it('should accept a table pattern and require its params', () => {
    const app = (
      <MemoryRouter routes={routes}>
        <nav>
          <TypedNavLink<Paths> to="/" end />
          <TypedNavLink<Paths> to="/users/:id" params={{id: '7'}} />
          <TypedNavLink<Paths>
            to="/files/*rest"
            params={{rest: ['a', 'b']}}
            caseSensitive
            ariaCurrent="step"
          >
            Files
          </TypedNavLink>
        </nav>
        <View />
      </MemoryRouter>
    );
    expectTypeOf(app).not.toBeNever();
  });

  it('should reject a path outside the table and wrong param shapes', () => {
    // @ts-expect-error '/help' is not a pattern of the table
    <TypedNavLink<Paths> to="/help" />;
    // @ts-expect-error params are required for '/users/:id'
    <TypedNavLink<Paths> to="/users/:id" />;
    // @ts-expect-error id must be a string, not a number
    <TypedNavLink<Paths> to="/users/:id" params={{id: 7}} />;
    // @ts-expect-error wildcard params are string arrays
    <TypedNavLink<Paths> to="/files/*rest" params={{rest: 'a'}} />;
    // Static patterns take no params — enforced at the props type level.
    // (Through the single-type-argument `as` overload the loose index
    // signature lets an extra `params` key through; that flavor trades
    // this check for unchecked `as`-props.)
    // @ts-expect-error static patterns take no params
    const badStatic: TypedNavLinkProps<Paths> = {to: '/', params: {id: '7'}};
    void badStatic;
  });

  it('should compose an as component with a single type argument', () => {
    // The contract's exact shape: one type argument plus `as` — the
    // `as`-props region is unchecked, the pattern union still enforced.
    <TypedNavLink<Paths> to="/" end as={PillLink} variant="primary" />;
    // The discrimination survives the loose intersection.
    // @ts-expect-error a path outside the table is still rejected
    <TypedNavLink<Paths> to="/help" as={PillLink} />;
    // @ts-expect-error params are still required for '/users/:id'
    <TypedNavLink<Paths> to="/users/:id" as={PillLink} />;
  });

  it('should fully check the as component with both type arguments', () => {
    const anchorRef = createRef<HTMLAnchorElement>();
    <TypedNavLink<Paths, typeof PillLink>
      to="/users/:id"
      params={{id: '7'}}
      variant="primary"
      ref={anchorRef}
    />;
    <TypedNavLink<Paths, typeof PillLink> to="/" variant="ghost" end />;
    // @ts-expect-error variant is required by PillLink
    <TypedNavLink<Paths, typeof PillLink> to="/" />;
    // @ts-expect-error 'nope' is not a PillLink variant
    <TypedNavLink<Paths, typeof PillLink> to="/" variant="nope" />;
    // @ts-expect-error PlainLink does not take a ref (no forwardRef)
    <TypedNavLink<Paths, typeof PlainLink> to="/" ref={anchorRef} />;
  });

  it('should keep the active-state callbacks typed', () => {
    <TypedNavLink<Paths>
      to="/"
      className={({isActive, isExactActive}) =>
        isActive && isExactActive ? 'on' : 'off'
      }
      style={({isActive}) => ({top: isActive ? '1px' : '2px'})}
    >
      {({isActive}) => (isActive ? 'Home*' : 'Home')}
    </TypedNavLink>;
  });
});

describe('TypedPrefetchLink', () => {
  type Paths = '/' | '/users/:id';

  it('should keep the prefetch strategy and require pattern params', () => {
    <TypedPrefetchLink<Paths> to="/" prefetch="render" />;
    <TypedPrefetchLink<Paths>
      to="/users/:id"
      params={{id: '7'}}
      prefetch="viewport"
    />;
    // @ts-expect-error params are required for '/users/:id'
    <TypedPrefetchLink<Paths> to="/users/:id" />;
    // @ts-expect-error the strategy union still applies
    <TypedPrefetchLink<Paths> to="/" prefetch="nope" />;
    // @ts-expect-error a path outside the table is rejected
    <TypedPrefetchLink<Paths> to="/help" />;
  });

  it('should compose an as component with a single type argument', () => {
    <TypedPrefetchLink<Paths>
      to="/users/:id"
      params={{id: '7'}}
      as={PillLink}
      variant="primary"
    />;
    // Both arguments keep the full checking.
    <TypedPrefetchLink<Paths, typeof PillLink>
      to="/"
      variant="ghost"
      prefetch="render"
    />;
    // @ts-expect-error variant is required by PillLink
    <TypedPrefetchLink<Paths, typeof PillLink> to="/" prefetch="render" />;
  });
});

// 任务：TypedLink 家族 search 类型化——组件收整个路由表作类型实参
// （TypedLink<typeof routes>）时，to/params/search 三位一体判别：search
// 取该模式叶子层 schema 的 INPUT（~standard.types 幻影对，zod/valibot/
// arktype 均携带；react 重导出的 StandardSchemaV1 含该可选成员），
// 无 schema 的模式保持宽松 SearchInput。paths-union 老用法
// （TypedLink<RoutePaths<...>>）search 宽松，零影响兼容。
describe('TypedLink search typing', () => {
  // 注解风格夹具：StandardSchemaV1<Input, Output>（react 重导出的
  // spec 完整形）——注解本身就把 input 带进静态形状，无需运行时值。
  // URL 侧 input：page 是 string（schema 会 coerce），tag 重复键成数组。
  const listSearch: StandardSchemaV1<
    {page?: string; tag?: string[]},
    {page: number; tag: string[]}
  > = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => ({
        value: value as {page: number; tag: string[]}
      })
    }
  };

  const routes = createRoutes({
    children: [
      {path: '/list', search: listSearch, component: () => Page},
      {path: '/plain', component: () => Page},
      {path: '/users/:id', search: listSearch, component: () => Page},
      {
        path: '/section',
        children: [{path: '/inner', search: listSearch, component: () => Page}]
      }
    ]
  });
  type Table = typeof routes;

  it('should derive RouteSearchInputOf from the schema input side', () => {
    type ListRoute = NonNullable<Table['children']>[0];
    expectTypeOf<ListRoute['path']>().toEqualTypeOf<'/list'>();
    expectTypeOf<RouteSearchInputOf<ListRoute>>().toEqualTypeOf<{
      page?: string;
      tag?: string[];
    }>();
  });

  it('should degrade RouteSearchInputOf to SearchInput without input info', () => {
    // 无 schema 的层：宽松 SearchInput。
    type PlainRoute = NonNullable<Table['children']>[1];
    expectTypeOf<RouteSearchInputOf<PlainRoute>>().toEqualTypeOf<SearchInput>();
    // core 风格注解（input 位 unknown，无 types 承载）：同样拿不到 → 宽松。
    const bareSearch: StandardSchemaV1<unknown, {page: number}> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value) => ({value: value as {page: number}})
      }
    };
    const bare = createRoutes({
      children: [{path: '/bare', search: bareSearch, component: () => Page}]
    });
    void bare;
    expectTypeOf<
      RouteSearchInputOf<NonNullable<(typeof bare)['children']>[number]>
    >().toEqualTypeOf<SearchInput>();
  });

  it('should accept the schema input and keep search optional', () => {
    const app = (
      <MemoryRouter routes={routes}>
        <TypedLink<Table> to="/list" search={{page: '2'}} />
        <TypedLink<Table> to="/list" search={{tag: ['a', 'b']}} />
        {/* search 可省略：不传零影响 */}
        <TypedLink<Table> to="/list" />
        {/* params 与 search 在同一模式上联合判别 */}
        <TypedLink<Table>
          to="/users/:id"
          params={{id: '7'}}
          search={{page: '1'}}
        />
        <View />
      </MemoryRouter>
    );
    expectTypeOf(app).not.toBeNever();
  });

  it('should reject a search the pattern schema contradicts', () => {
    // @ts-expect-error nope 不是 /list schema input 的字段
    <TypedLink<Table> to="/list" search={{nope: 'x'}} />;
    // @ts-expect-error page 的 input 是 string，不是 number
    <TypedLink<Table> to="/list" search={{page: 2}} />;
    // @ts-expect-error /users/:id 的 schema 同样拒收未知字段（与 params 联合判别）
    <TypedLink<Table>
      to="/users/:id"
      params={{id: '7'}}
      search={{nope: 'x'}}
    />;
  });

  it('should keep schema-less patterns loose and still check params', () => {
    <TypedLink<Table> to="/plain" search={{anything: 'goes', n: ['1']}} />;
    // @ts-expect-error params 仍按模式判别，search 不豁免缺参
    <TypedLink<Table> to="/users/:id" search={{page: '1'}} />;
  });

  it('should carry the search typing through layout prefixes', () => {
    <TypedLink<Table> to="/section/inner" search={{page: '3'}} />;
    // @ts-expect-error 前缀拼接后的模式仍持有叶子层 schema input
    <TypedLink<Table> to="/section/inner" search={{nope: 'x'}} />;
  });

  it('should keep search loose in the paths-union and degraded flavors', () => {
    type Paths = RoutePaths<Table>;
    // paths union 不携带 schema：search 退化为 SearchInput（URL 输入形状）。
    <TypedLink<Paths> to="/list" search={{page: '2'}} />;
    // @ts-expect-error 宽松 ≠ 任意：SearchInput 只收 string | string[]
    <TypedLink<Paths> to="/list" search={{page: 2}} />;
    // 完全退化（无类型实参）同宽。
    <TypedLink to="/list" search={{page: '2'}} />;
  });

  it('should type search on TypedNavLink and TypedPrefetchLink alike', () => {
    <TypedNavLink<Table> to="/list" search={{page: '2'}} end />;
    // @ts-expect-error 同一判别联合
    <TypedNavLink<Table> to="/list" search={{page: 2}} />;
    <TypedPrefetchLink<Table>
      to="/list"
      search={{tag: ['x']}}
      prefetch="render"
    />;
    // @ts-expect-error 同一判别联合
    <TypedPrefetchLink<Table>
      to="/list"
      prefetch="render"
      search={{nope: 'x'}}
    />;
  });

  it('should keep search checked through an as component', () => {
    <TypedLink<Table, typeof PillLink>
      to="/list"
      search={{page: '2'}}
      variant="primary"
    />;
    // as 组合不放松 search 判别：错误钉在属性上（number → string input）。
    <TypedLink<Table, typeof PillLink>
      to="/list"
      variant="primary"
      // @ts-expect-error page 的 input 是 string，不是 number
      search={{page: 2}}
    />;
  });
});

// 任务：Router context 透传——context 从组件 props/createRouter options
// 推导，流入 Route<P, S, C> 的 data/beforeLoad ctx.context。
describe('Router context typing', () => {
  type AppContext = {api: {list(): string[]}; tag: string};

  it('should infer the context type from the Router props', () => {
    const routes: Route[] = [{path: '/', component: () => Page}];
    <MemoryRouter routes={routes} context={{api: {list: () => []}, tag: 'x'}}>
      <View />
    </MemoryRouter>;
    // Each usage infers its own C; pin it to assert the shape contract.
    // @ts-expect-error a missing api member does not satisfy the pinned shape
    <MemoryRouter<AppContext> routes={routes} context={{tag: 'x'}}>
      <View />
    </MemoryRouter>;
  });

  it('should type ctx.context of data and beforeLoad through Route<P, S, C>', () => {
    type AppRoute<P extends string = string, S = any> = Route<P, S, AppContext>;
    const routes = {
      path: '/list' as const,
      data: (ctx: Parameters<NonNullable<AppRoute<'/list'>['data']>>[0]) => {
        expectTypeOf(ctx.context).toEqualTypeOf<AppContext>();
        return ctx.context.api.list();
      },
      beforeLoad: (
        ctx: Parameters<NonNullable<AppRoute<'/list'>['beforeLoad']>>[0]
      ) => (ctx.context.tag ? undefined : '/')
    };
    void routes;
    expectTypeOf<
      Parameters<
        NonNullable<Route<'/list', any, AppContext>['data']>
      >[0]['context']
    >().toEqualTypeOf<AppContext>();
    expectTypeOf<
      Parameters<
        NonNullable<Route<'/list', any, AppContext>['beforeLoad']>
      >[0]['context']
    >().toEqualTypeOf<AppContext>();
    // Un-annotated levels stay loose (any) — assignability to plain Route.
    expectTypeOf<
      Parameters<NonNullable<Route['data']>>[0]['context']
    >().toEqualTypeOf<any>();
  });

  it('should type createRouter return context from the option', async () => {
    const {createMemoryHistory} = await import('history');
    const history = createMemoryHistory();
    const appContext: AppContext = {
      api: {
        list: () => []
      },
      tag: 'x'
    };
    const router = createRouter([{path: '/'}], history, {
      context: appContext
    });
    expectTypeOf(router.context).toEqualTypeOf<AppContext>();
    const plain = createRouter([{path: '/'}], createMemoryHistory());
    expectTypeOf(plain.context).toEqualTypeOf<undefined>();
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

// 任务：createRoutes 的 search 类型闭环——返回表上每层 data/beforeLoad 的
// ctx.search 从该层自己的 search schema 输出推导（SearchRoutesOf）。
describe('createRoutes search closure', () => {
  // 手写 Standard Schema 夹具（与 core 测试同款）：coerce page 为正整数。
  const pageSchema: StandardSchemaV1<unknown, {page: number}> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        const n = Number((value as {page?: unknown}).page);
        return {
          value: {page: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0}
        };
      }
    }
  };

  it('should derive ctx.search of data and beforeLoad from the level schema', () => {
    const routes = createRoutes({
      children: [
        {
          path: '/list',
          search: pageSchema,
          beforeLoad: ({search}) =>
            search.page > 0 ? undefined : '/list?page=1',
          data: ({search}): number => search.page
        }
      ]
    });
    void routes;
    type ListRoute = NonNullable<(typeof routes)['children']>[number];
    expectTypeOf<
      Parameters<NonNullable<ListRoute['data']>>[0]['search']
    >().toEqualTypeOf<{page: number}>();
    expectTypeOf<
      Parameters<NonNullable<ListRoute['beforeLoad']>>[0]['search']
    >().toEqualTypeOf<{page: number}>();
    // 返回类型原样保留（loader 声明的返回不丢）。
    expectTypeOf<
      ReturnType<NonNullable<ListRoute['data']>>
    >().toEqualTypeOf<number>();
    // path 字面量仍在：RoutePaths/TypedLink 契约不受影响。
    expectTypeOf<ListRoute['path']>().toEqualTypeOf<'/list'>();
  });

  it('should degrade ctx.search to SearchInput on schema-less levels', () => {
    const routes = createRoutes({
      children: [
        {path: '/plain', beforeLoad: ({search}) => (search.q ? undefined : '/')}
      ]
    });
    void routes;
    type PlainRoute = NonNullable<(typeof routes)['children']>[number];
    expectTypeOf<
      Parameters<NonNullable<PlainRoute['beforeLoad']>>[0]['search']
    >().toEqualTypeOf<SearchInput>();
  });

  it('should recurse through nested children', () => {
    const routes = createRoutes({
      children: [
        {
          path: '/section',
          children: [
            {
              path: '/inner',
              search: pageSchema,
              data: ({search}) => search.page
            }
          ]
        }
      ]
    });
    void routes;
    type Inner = NonNullable<
      NonNullable<
        NonNullable<(typeof routes)['children']>[number]['children']
      >[number]
    >;
    expectTypeOf<
      Parameters<NonNullable<Inner['data']>>[0]['search']
    >().toEqualTypeOf<{page: number}>();
  });

  it('should reject a callback annotation that contradicts the schema', () => {
    createRoutes({
      children: [
        {
          path: '/list',
          search: pageSchema,
          // @ts-expect-error {page: string} 与 schema 输出 {page: number} 冲突
          data: ({search}: {search: {page: string}}): string => search.page
        }
      ]
    });
  });

  it('should drift-check ctx.search against the derived table types', () => {
    const routes = createRoutes({
      children: [
        {path: '/list', search: pageSchema, data: ({search}) => search.page}
      ]
    });
    void routes;
    type ListCtx = Parameters<
      NonNullable<NonNullable<(typeof routes)['children']>[number]['data']>
    >[0];
    // @ts-expect-error page 是 number，不接受 string 值形状
    const wrong: ListCtx['search'] = {page: 'one'};
    // @ts-expect-error 不存在的字段
    const missing: ListCtx['search'] = {nonexistent: 1};
    void wrong;
    void missing;
  });

  it('should keep the explicit Route<P, S> generic in charge when written', () => {
    type Manual = {page: string};
    const manual: Route<'/manual', Manual> = {
      path: '/manual',
      search: pageSchema,
      data: ({search}) => search.page
    };
    expectTypeOf<
      Parameters<NonNullable<Route<'/manual', Manual>['data']>>[0]['search']
    >().toEqualTypeOf<Manual>();
    // Route['beforeLoad'] 注解（painless requireLogin 模式）仍可用。
    const guard: Route['beforeLoad'] = ({search}) => (search ? undefined : '/');
    void guard;
    void manual;
  });
});

// 任务：useBlocker 谓词契约（返回 `true` 放行、`false` 否决）在类型层
// 能钉住的那一半。「返回 true = 阻止」的方向性误读无法靠类型区分
// （true/false 同为 boolean），那半边靠 src/use-blocker.ts 的 JSDoc 与
// test/integration.test.tsx 的 useBlocker describe 的运行时断言把守；
// 类型层能挡住的是「真值非 boolean 冒充裁决」这一同族错误。
describe('useBlocker predicate contract', () => {
  const dirtyRef = {current: false};

  it('should type the predicate as (to, from) => boolean', () => {
    expectTypeOf<Parameters<typeof useBlocker>[0]>().toEqualTypeOf<
      (to: string, from: string) => boolean
    >();
  });

  it('should reject a truthy non-boolean verdict', () => {
    const fn: Parameters<typeof useBlocker>[0] = () =>
      // @ts-expect-error a truthy string is not a boolean verdict
      dirtyRef.current ? 'dirty' : '';
    void fn;
  });
});
