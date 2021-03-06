import React, { Children } from "react";

import Theme from "../theme/default";
import { lightenColor } from "../utils";

const INDENT_WIDTH_PX = 25;
const STEM_WIDTH_PX = 1;
const LEVEL_STEM_HEIGHT_PX = 35;

interface ThreadContext extends ThreadProps {
  addResizeCallback: (callback: () => void) => void;
  removeResizeCallback: (callback: () => void) => void;
  registerItemBoundary: (element: {
    levelElement: HTMLElement;
    boundaryElement: HTMLElement;
  }) => void;
  unregisterItemBoundary: (element: { levelElement: HTMLElement }) => void;
  getPreviousLevelBoundaries: (levelElement: HTMLElement) => HTMLElement[];
  getNextLevelBoundaries: (
    levelElement: HTMLElement
  ) => {
    levelElement: HTMLElement;
    boundaryElement: HTMLElement;
  }[];
}

const ThreadContext = React.createContext<ThreadContext | null>(null);
const ThreadLevel = React.createContext<number>(0);

interface ThreadProps {
  onCollapseLevel: (id: string) => void;
  onUncollapseLevel: (id: string) => void;
  getCollapseReason: (id: string) => React.ReactNode;
}

const isIndentElement = (
  node: React.ReactNode
): node is React.Component<IndentProps> => {
  return React.isValidElement(node) && node.type == Indent;
};

const isThreadItem = (
  node: React.ReactNode
): node is React.Component<IndentProps> => {
  return React.isValidElement(node) && node.type == Item;
};

const processItemChildren = (children: React.ReactNode | undefined) => {
  const indent = Children.toArray(children).find(isIndentElement);
  const levelItems = Children.toArray(children).filter(
    (child) => !isIndentElement(child)
  );
  return { levelItems, indent };
};

interface ChildrenWithRenderProps {
  children?:
    | JSX.Element
    | ((refCallback: (element: HTMLElement | null) => void) => React.ReactNode);
}

const useResizeCallbacks = (toWatch: React.RefObject<HTMLElement>) => {
  const resizeCallbacks = React.useRef<(() => void)[]>([]);
  React.useEffect(() => {
    if (!toWatch.current) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      resizeCallbacks.current.forEach((callback) => callback());
    });
    resizeObserver.observe(toWatch.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [toWatch]);
  const addResizeCallback = React.useCallback((callback: () => void) => {
    resizeCallbacks.current.push(callback);
  }, []);
  const removeResizeCallback = React.useCallback((callback: () => void) => {
    resizeCallbacks.current = resizeCallbacks.current.filter(
      (entry) => callback != entry
    );
  }, []);

  return {
    addResizeCallback,
    removeResizeCallback,
  };
};

const useBoundariesMap = () => {
  const levelsBoundariesMap = React.useRef(new Map<HTMLElement, HTMLElement>());
  const registerItemBoundary = React.useCallback(
    (element: { levelElement: HTMLElement; boundaryElement: HTMLElement }) => {
      levelsBoundariesMap.current.set(
        element.levelElement,
        element.boundaryElement
      );
    },
    []
  );
  const unregisterItemBoundary = React.useCallback(
    (element: { levelElement: HTMLElement }) => {
      levelsBoundariesMap.current.delete(element.levelElement);
    },
    []
  );
  const getNextLevelBoundaries = React.useCallback(
    (levelElement: HTMLElement) => {
      const nextLevelBoundaries: {
        levelElement: HTMLElement;
        boundaryElement: HTMLElement;
      }[] = [];
      const nextLevelElements = levelElement.querySelectorAll(
        ":scope > ol > li"
      );
      nextLevelElements.forEach((element) => {
        const boundaryElement:
          | HTMLElement
          | undefined = levelsBoundariesMap.current.get(element as HTMLElement);
        if (!boundaryElement) {
          // This can happen when an element is added after the first render, and has not yet registered
          // while the parent is already re-rendering.
          return;
        }
        nextLevelBoundaries.push({
          levelElement: element as HTMLElement,
          boundaryElement,
        });
      });
      return nextLevelBoundaries;
    },
    []
  );
  const getPreviousLevelBoundaries = React.useCallback(
    (levelElement: HTMLElement) => {
      const previousLevelBoundaries: HTMLElement[] = [];
      return previousLevelBoundaries;
    },
    []
  );

  return {
    registerItemBoundary,
    unregisterItemBoundary,
    getNextLevelBoundaries,
    getPreviousLevelBoundaries,
  };
};

/**
 * This is how the thread structure is supposed to look like:
 *
 * <Thread>
 *   <Post>
 *   <Thread.Indent>
 *     <Thread.Item><Post></Thread.Item>
 *     <Thread.Item><Post></Thread.Item>
 *     <Thread.Item><Post></Thread.Item>
 *     <Thread.Item>
 *        <Post>
 *        <Thread.Indent>
 *          <Thread.Item><Post></Thread.Item>
 *          <Thread.Item><Post></Thread.Item>
 *        </Thread.Indent>
 *      </Thread.Item>
 *   </Thread.Indent>
 * </Thread>
 *
 * IMPORTANT NOTE: Thread.Indent should always be a direct discendant of Thread.Item.
 * If a component is wrapped around levels of these tree, make sure that it wraps a
 * Thread.Item and not simply the indentation.
 */
const Thread: React.FC<ThreadProps & ChildrenWithRenderProps> & {
  Indent: typeof Indent;
  Item: typeof Item;
} = (props) => {
  // When the overall thread container is resized, cycle through all the handlers to
  // "warn" the stems that readjustment might be needed (+ whatever other callback might
  // have been assigned).
  const threadRef = React.createRef<HTMLDivElement>();
  const { addResizeCallback, removeResizeCallback } = useResizeCallbacks(
    threadRef
  );
  const {
    registerItemBoundary,
    unregisterItemBoundary,
    getPreviousLevelBoundaries,
    getNextLevelBoundaries,
  } = useBoundariesMap();

  // We wrap children in a Thread.Item, so we can simply use the regular Thread.Item
  // recursion even for the first level. We do this unless the child is already a
  // Thread.Item, mostly so if the first level can be done through recursion there's
  // no need for the users of this class to special case it.
  const children = isThreadItem(props.children) ? (
    props.children
  ) : (
    <Thread.Item>{props.children}</Thread.Item>
  );
  return (
    <ThreadContext.Provider
      value={React.useMemo(
        () => ({
          ...props,
          addResizeCallback,
          removeResizeCallback,
          registerItemBoundary,
          unregisterItemBoundary,
          getPreviousLevelBoundaries,
          getNextLevelBoundaries,
        }),
        [
          props,
          addResizeCallback,
          removeResizeCallback,
          registerItemBoundary,
          unregisterItemBoundary,
          getPreviousLevelBoundaries,
          getNextLevelBoundaries,
        ]
      )}
    >
      <div className="thread" ref={threadRef} data-thread-start="true">
        {children}
        <style jsx>{`
          .thread {
            width: 100%;
            max-width: 550px;
          }
        `}</style>
      </div>
    </ThreadContext.Provider>
  );
};

const getLevelIndex = (levelElement: HTMLElement) => {
  let previousSibling = levelElement.previousElementSibling;
  while (previousSibling && !(previousSibling instanceof HTMLElement)) {
    previousSibling = levelElement.previousElementSibling;
  }
  const previousLevel =
    (previousSibling as HTMLElement)?.dataset.listIndex || "0";
  return parseInt(previousLevel) + 1;
};

const getParentId = (levelElement: HTMLElement) => {
  let parent = levelElement.parentElement;
  while (parent && !parent.dataset.threadStart) {
    if (parent.dataset.itemId) {
      return parent.dataset.itemId;
    }
    parent = parent.parentElement;
  }
  return null;
};

const setLevelStemBoundaries = ({
  levelElement,
  boundaryElement,
  nextLevelBoundaries,
}: {
  levelElement: HTMLElement;
  boundaryElement: HTMLElement;
  nextLevelBoundaries: HTMLElement[];
}) => {
  const {
    top: levelTop,
    left: levelLeft,
    bottom: levelBottom,
  } = levelElement.getBoundingClientRect();
  const {
    bottom: boundaryBottom,
    left: boundaryLeft,
    width: boundaryWidth,
  } = boundaryElement.getBoundingClientRect();
  levelElement.style.setProperty(
    "--stem-margin-top",
    `${boundaryBottom - levelTop}px`
  );
  const boundaryMiddlePoint = boundaryLeft - levelLeft + boundaryWidth / 2;
  levelElement.style.setProperty(
    "--stem-margin-left",
    `${boundaryMiddlePoint - STEM_WIDTH_PX / 2}px`
  );
  if (nextLevelBoundaries.length) {
    const { top: nextLevelTop, height: nextLevelHeight } = nextLevelBoundaries[
      nextLevelBoundaries.length - 1
    ].getBoundingClientRect();
    levelElement.style.setProperty(
      "--stem-margin-bottom",
      `${levelBottom - nextLevelTop + STEM_WIDTH_PX / 2 - 5}px`
    );
  }
};

const setNextLevelStemBoundaries = ({
  levelBoundary,
  nextLevelElement,
  nextLevelBoundary,
}: {
  levelBoundary: HTMLElement;
  nextLevelElement: HTMLElement;
  nextLevelBoundary: HTMLElement;
}) => {
  const {
    left: levelBoundaryLeft,
    width: levelBoundaryWidth,
  } = levelBoundary.getBoundingClientRect();

  const {
    top: nextLevelTop,
    left: nextLevelLeft,
  } = nextLevelElement.getBoundingClientRect();
  const {
    left: nextLevelBoundaryLeft,
    top: nextLevelBoundaryTop,
    height: nextLevelBoundaryHeight,
  } = nextLevelBoundary.getBoundingClientRect();
  const currentLevelMiddlePoint = levelBoundaryLeft + levelBoundaryWidth / 2;
  const stemLeft = currentLevelMiddlePoint - nextLevelLeft - STEM_WIDTH_PX / 2;
  nextLevelElement.style.setProperty("--level-stem-left", `${stemLeft}px`);
  // We start the level stem so that, overall, the height occupied by the level stem
  // is the one in STEM_LEVEL_HEIGHT
  nextLevelElement.style.setProperty(
    "--level-stem-top",
    `${nextLevelBoundaryTop - nextLevelTop + STEM_WIDTH_PX / 2 - 5}px`
  );
  nextLevelElement.style.setProperty(
    "--level-stem-margin-bottom",
    `${nextLevelBoundaryHeight / 2 - STEM_WIDTH_PX / 2 + 5}px`
  );
  nextLevelElement.style.setProperty(
    "--level-stem-height",
    `${nextLevelBoundaryHeight / 2 + 5}px`
  );
  nextLevelElement.style.setProperty(
    "--level-stem-width",
    `${nextLevelBoundaryLeft - currentLevelMiddlePoint + STEM_WIDTH_PX / 2}px`
  );
};

const Item: React.FC<ChildrenWithRenderProps> = (props) => {
  const threadContext = React.useContext(ThreadContext);
  const level = React.useContext(ThreadLevel);
  const [
    boundaryElement,
    setBoundaryElement,
  ] = React.useState<HTMLElement | null>(null);
  const levelContent = React.createRef<HTMLLIElement & HTMLDivElement>();
  const levelStem = React.createRef<HTMLDivElement>();
  const levelStemContainer = React.createRef<HTMLDivElement>();

  let children: React.ReactNode = props.children;
  if (typeof props.children == "function") {
    children = props.children(setBoundaryElement);
    // Since thread indent must always be a direct child of Item, but the component
    // rendered by using a render props function will likely need to wrap more than one
    // element as a return value, we check if the returned children are a fragment,
    // and just iterate on the returned children in that case.
    if (React.isValidElement(children) && children.type === React.Fragment) {
      children = children.props.children;
    }
  }

  React.useEffect(() => {
    if (!boundaryElement || !levelContent.current || !threadContext) {
      return;
    }
    const levelElement = levelContent.current;
    const index = getLevelIndex(levelElement);
    const parentId = getParentId(levelElement);
    levelElement.dataset.levelIndex = "" + index;
    const itemId = parentId ? parentId + "_" + parentId : "" + index;
    levelElement.dataset.itemId = itemId;
    threadContext.registerItemBoundary({
      levelElement,
      boundaryElement,
    });
    const setStemPositions = () => {
      const nextLevelBoundaries = threadContext.getNextLevelBoundaries(
        levelElement
      );
      console.log(nextLevelBoundaries);
      setLevelStemBoundaries({
        levelElement,
        boundaryElement,
        nextLevelBoundaries: nextLevelBoundaries.map((v) => v.boundaryElement),
      });
      nextLevelBoundaries.forEach((boundary) => {
        setNextLevelStemBoundaries({
          levelBoundary: boundaryElement,
          nextLevelElement: boundary.levelElement,
          nextLevelBoundary: boundary.boundaryElement,
        });
      });
    };
    threadContext?.addResizeCallback(setStemPositions);
    setStemPositions();
    return () => {
      threadContext.removeResizeCallback(setStemPositions);
      threadContext.unregisterItemBoundary({ levelElement });
    };
  }, [boundaryElement, threadContext, levelContent, level]);

  const { levelItems, indent } = processItemChildren(children);
  if (Children.toArray(children).some(isThreadItem)) {
    throw new Error("Items shouldn't be children of items");
  }
  const stemColor =
    Theme.INDENT_COLORS[(level - 1) % Theme.INDENT_COLORS.length];
  const content = (
    <>
      <div className={`thread-element`}>
        <div className="level-stem-container" ref={levelStemContainer}>
          <div className="level-stem" ref={levelStem} />
        </div>
        {levelItems}
      </div>
      {React.isValidElement(indent) &&
        React.cloneElement(indent, {
          ...indent.props,
          // Add this so an indent that is not a direct child of an item will
          // raise an exception
          _childOfItem: true,
        })}
      <style jsx>{`
        .thread-element {
          position: relative;
          z-index: 2;
          pointer-events: none;
        }
        .thread-element
          > :global(*:not(.level-item .level-container .thread-element)) {
          pointer-events: all;
        }
        .level-stem-container {
          position: absolute;
          top: var(--level-stem-top, 0);
          bottom: 0;
          left: var(--level-stem-left, 0);
          pointer-events: all;
        }
        .level-stem {
          position: sticky;
          width: var(--level-stem-width, 0);
          top: 5px;
          height: var(--level-stem-height, 0);
          margin-bottom: var(--level-stem-margin-bottom, 0);
          border-left: ${STEM_WIDTH_PX}px solid ${stemColor};
          border-bottom: ${STEM_WIDTH_PX}px solid ${stemColor};
          box-sizing: border-box;
          border-bottom-left-radius: 15px;
        }
      `}</style>
    </>
  );
  // We only wrap the result in a <li> when it's above level 0, and is thus child
  // of a Thread.Indent
  return (
    <>
      {level === 0 ? (
        <div data-level={0} ref={levelContent}>
          {content}
        </div>
      ) : (
        <li data-level={level} className={`level-item`} ref={levelContent}>
          {content}
        </li>
      )}
      <style jsx>{`
        li.level-item {
          position: relative;
          pointer-events: none;
          --stem-margin-top: 0;
        }
        div[data-level="0"] {
          position: relative;
          --stem-margin-top: 0;
        }
      `}</style>
    </>
  );
};

interface StemProps {
  clickHandler: () => void;
}
export const Stem: React.FC<StemProps> = (props) => {
  const level = React.useContext(ThreadLevel);
  const stemHoverEnterHandler = React.useCallback((e) => {
    const target = e.target as HTMLElement;
    target.classList.add("hover");
  }, []);
  const stemHoverLeaveHandler = React.useCallback((e) => {
    const target = e.target as HTMLElement;
    target.classList.remove("hover");
  }, []);

  const stemColor = Theme.INDENT_COLORS[level % Theme.INDENT_COLORS.length];
  const stemHoverColor = lightenColor(stemColor, 0.07);
  return (
    <>
      <button
        className={`thread-stem`}
        data-level={level}
        onMouseEnter={stemHoverEnterHandler}
        onMouseLeave={stemHoverLeaveHandler}
        onClick={props.clickHandler}
      />
      <style jsx>{`
        .thread-stem {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: ${STEM_WIDTH_PX}px;
          background-color: ${stemColor};
          pointer-events: all;
          border: 0;
          padding: 0;
          margin-top: var(--stem-margin-top, 0);
          margin-left: var(--stem-margin-left, 0);
          margin-bottom: var(--stem-margin-bottom, 0);
        }
        .thread-stem:focus {
          outline: none;
        }
        .thread-stem:focus-visible {
          outline: auto;
        }
        .thread-stem.hover {
          cursor: pointer;
          background-color: ${stemHoverColor};
          z-index: 1;
          box-shadow: 0 0 6px 0 rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.1);
        }
        .thread-stem[data-level="0"] {
          left: 0px;
        }
      `}</style>
    </>
  );
};

interface IndentProps {
  id: string | null;
  collapsed?: boolean;
  // Internal: do not use.
  _childOfItem?: boolean;
}
export const Indent: React.FC<IndentProps> = (props) => {
  const threadContext = React.useContext(ThreadContext);
  const level = React.useContext(ThreadLevel);
  const childrenArray = React.Children.toArray(props.children);

  if (!props._childOfItem) {
    throw new Error("indent should be child of item");
  }

  const stemClickHandler = React.useCallback(() => {
    if (props.collapsed) {
      threadContext?.onUncollapseLevel?.(props.id as string);
    } else {
      threadContext?.onCollapseLevel?.(props.id as string);
    }
  }, [threadContext, props.collapsed, props.id]);

  return (
    <>
      <Stem clickHandler={stemClickHandler} />
      <ol data-level={level + 1} className={`level-container`}>
        <ThreadLevel.Provider value={level + 1}>
          {childrenArray}
        </ThreadLevel.Provider>
        <style jsx>{`
          ol.level-container {
            list-style: none;
            position: relative;
            margin-inline-start: ${INDENT_WIDTH_PX}px;
            padding-inline-start: 0;
            pointer-events: none;
            margin-block-start: 0;
          }
          ol.level-container[data-level="1"] {
            padding-inline-start: 0;
          }
        `}</style>
      </ol>
    </>
  );
};

Thread.Indent = Indent;
Thread.Item = Item;
export default Thread;
