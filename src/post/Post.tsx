import React from "react";

import UpdatesHeader from "./UpdatesHeader";
import Header, { HeaderStyle } from "./Header";
import Footer from "./Footer";
import Tags from "../tags/Tags";
import DropdownListMenu, { DropdownProps } from "../common/DropdownListMenu";
import Card from "../common/Card";
import Reaction from "../common/Reaction";
import Editor from "@bobaboard/boba-editor";
import classnames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import TagsFactory from "../tags/TagsFactory";

import Theme from "../theme/default";
import debug from "debug";
import { LinkWithAction, TagsType } from "types";
import { AvatarProps } from "./Avatar";

const log = debug("bobaui:post-log");

export const modes = {
  VIEW: "VIEW",
  CREATE: "CREATE",
};

export enum PostSizes {
  REGULAR,
  WIDE,
}

export const getPostWidth = (size?: PostSizes): number => {
  switch (size) {
    case PostSizes.WIDE:
      return 850;
    case PostSizes.REGULAR:
    default:
      return 550;
  }
};

const COLLAPSED_HEIGHT = 150;

const MemoizedHeader = React.memo(Header);
const MemoizedFooter = React.memo(Footer);
const MemoizedEditor = React.memo(Editor);
const Post = React.forwardRef<PostHandler, PostProps>((props, ref) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const avatarRef = React.createRef<HTMLDivElement>();
  const hasUpdate =
    props.newComments || props.newContributions || props.newPost;

  React.useImperativeHandle(ref, () => ({
    highlight: (color: string) => {
      log(`Highlighting post with ${color}!`);
      if (!containerRef.current) {
        return;
      }
      containerRef.current.ontransitionend = () => {
        containerRef.current?.style.setProperty(
          "--card-container-shadow",
          null
        );
      };
      containerRef.current.style.setProperty("--card-container-shadow", color);
    },
    avatarRef,
  }));

  const hasFooterTags =
    !!props.tags?.categoryTags?.length ||
    !!props.tags?.indexTags?.length ||
    !!props.tags?.whisperTags?.length;
  return (
    <>
      <div
        className={classnames("post-container", { centered: props.centered })}
      >
        {hasUpdate && !props.hideUpdates && (
          <UpdatesHeader
            newPost={props.newPost}
            newComments={props.newComments}
            newContributions={props.newContributions}
          />
        )}
        <div
          className={classnames("tags content-warnings", {
            hidden: !props.tags?.contentWarnings?.length,
          })}
        >
          <Tags
            tags={TagsFactory.getTagsFromTagObject({
              indexTags: [],
              categoryTags: [],
              whisperTags: [],
              contentWarnings: props.tags?.contentWarnings || [],
            })}
            getOptionsForTag={props.getOptionsForTag}
            packBottom
          />
        </div>
        <div className="card-container" ref={containerRef}>
          <Card
            height={props.collapsed ? COLLAPSED_HEIGHT : undefined}
            backgroundColor={props.muted ? "#dcdcdc" : props.backgroundColor}
            header={
              <>
                <div className={classnames("header", { muted: props.muted })}>
                  <div className="header-container" ref={avatarRef}>
                    <MemoizedHeader
                      secretIdentity={props.secretIdentity}
                      userIdentity={props.userIdentity}
                      createdMessage={props.createdTime}
                      createdMessageLink={props.createdTimeLink}
                      size={HeaderStyle.REGULAR}
                      backgroundColor={props.muted ? "#dcdcdc" : undefined}
                      forceHide={props.forceHide}
                      accessory={props.accessory}
                    />
                  </div>
                  {props.menuOptions && (
                    <div className="post-options">
                      <DropdownListMenu
                        options={props.menuOptions}
                        header={props.menuOptionsHeader}
                      >
                        <span className="post-options-icon">
                          <FontAwesomeIcon icon={faEllipsisV} />
                        </span>
                      </DropdownListMenu>
                    </div>
                  )}
                </div>
                {props.board && (
                  <div
                    className="board-info"
                    style={{ backgroundColor: props.board.accentColor }}
                  >
                    {props.board.slug}
                  </div>
                )}
              </>
            }
            footer={
              <div
                className={classnames("footer", {
                  "with-reactions": !!props.reactions?.length,
                  muted: props.muted,
                  hidden: props.hideFooter,
                })}
              >
                <div className="notes">
                  <MemoizedFooter
                    onContribution={props.onNewContribution}
                    onComment={props.onNewComment}
                    totalContributions={props.totalContributions}
                    directContributions={props.directContributions}
                    totalComments={props.totalComments}
                    newContributions={props.newContributions}
                    newComments={props.newComments}
                    notesLink={props.notesLink}
                    answerable={props.answerable}
                  />
                </div>
                {!!props.reactable && (
                  <div className="reactions">
                    {props.reactions?.map((reaction) => (
                      <div className="reaction" key={reaction.image}>
                        <Reaction
                          image={reaction.image}
                          count={reaction.count}
                        />
                      </div>
                    ))}
                    <div className="add-reaction">
                      <FontAwesomeIcon icon={faPlus} />
                    </div>
                  </div>
                )}
              </div>
            }
          >
            <div className={classnames("content", { muted: props.muted })}>
              <MemoizedEditor
                initialText={JSON.parse(props.text)}
                editable={false}
                onEmbedLoaded={props.onEmbedLoaded}
              />
              <div
                className={classnames("tags", {
                  hidden: !props.tags || (props.hideFooter && !hasFooterTags),
                })}
              >
                <Tags
                  tags={
                    props.tags
                      ? TagsFactory.getTagsFromTagObject({
                          ...props.tags,
                          contentWarnings: [],
                        })
                      : []
                  }
                  getOptionsForTag={props.getOptionsForTag}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
      <style jsx>{`
        /*dynamic styles*/
        .post-container {
          width: ${getPostWidth(props.size)}px;
        }
      `}</style>
      <style jsx>{`
        /*static styles*/
        .muted {
          opacity: 0.9;
        }
        .header {
          border-radius: ${Theme.BORDER_RADIUS_REGULAR}
            ${Theme.BORDER_RADIUS_REGULAR} 0px 0px;
          padding: 10px 10px 5px;
          display: flex;
          border-bottom: 1px dotted rgba(0, 0, 0, 0.3);
          max-width: 100%;
          justify-content: space-between;
        }
        .header-container {
          max-width: calc(100% - 20px);
        }
        .post-container {
          position: relative;
          max-width: 100%;
        }
        .card-container {
          position: relative;
          pointer-events: all;
        }
        .card-container::after {
          content: "";
          top: 0px;
          bottom: 0px;
          left: 0px;
          right: 0px;
          position: absolute;
          z-index: -1;
          width: 100%;
          height: 100%;
          opacity: 0.8;
          border-radius: 15px;
          transition: box-shadow 0.5s ease-out;
          box-shadow: 0px 0px 8px 3px var(--card-container-shadow);
        }
        .footer {
          position: relative;
        }
        .footer.with-reactions {
          padding-bottom: 10px;
        }
        .tags {
          padding: 0 10px;
          text-align: left;
        }
        .content .tags {
          padding-top: 5px;
          border-top: 1px dotted rgba(0, 0, 0, 0.3);
        }
        .content-warnings {
          display: flex;
          align-items: flex-end;
          position: relative;
        }
        .content-warnings.hidden {
          display: none;
        }
        .add-reaction {
          background-color: rgb(28, 28, 28);
          height: 25px;
          width: 25px;
          border-radius: 50%;
          text-align: center;
          line-height: 25px;
          margin-top: 5px;
        }
        .add-reaction:hover {
          cursor: pointer;
        }
        .add-reaction :global(svg) {
          color: white;
        }
        .notes {
          padding: 15px;
          padding-top: 10px;
        }
        .reactions {
          display: flex;
          position: absolute;
          right: 17px;
          bottom: -20px;
        }
        .reaction {
          margin-right: 5px;
        }
        .header-container {
          flex: 1;
        }
        .post-options {
          width: 20px;
          height: 25px;
          text-align: center;
          line-height: 1em;
          margin: 2px -2px 0 0;
        }
        .post-options-icon {
          display: block;
          width: 20px;
          height: 20px;
          font-size: 16px;
          color: rgb(28, 28, 28);
        }
        .post-options-icon:hover {
          color: rgb(28, 28, 28, 0.8);
          cursor: pointer;
        }
        .board-info {
          background-color: ${props.board?.accentColor || "none"};
          text-align: center;
          padding: 3px;
          color: white;
          font-weight: bold;
        }
        .hidden {
          display: none;
        }
      `}</style>
    </>
  );
});

Post.displayName = "PostForwardRef";
export default Post;

export interface PostHandler {
  highlight: (color: string) => void;
  avatarRef?: React.RefObject<HTMLDivElement>;
}

export interface PostProps {
  mode?: string;
  editable?: boolean;
  answerable?: boolean;
  text: string;
  createdTime: string;
  createdTimeLink: LinkWithAction;
  secretIdentity: {
    avatar: string;
    name: string;
  };
  userIdentity?: {
    avatar: string;
    name: string;
  };
  tags?: {
    contentWarnings: string[];
    categoryTags: string[];
    whisperTags: string[];
    indexTags: string[];
  };
  reactions?: {
    image: string;
    count: number;
  }[];
  size?: PostSizes;
  newPost?: boolean;
  totalContributions?: number;
  directContributions?: number;
  newContributions?: number;
  totalComments?: number;
  newComments?: number;
  onNewContribution: () => void;
  onNewComment: () => void;
  collapsed?: boolean;
  muted?: boolean;
  notesLink: LinkWithAction;
  centered?: boolean;
  reactable?: boolean;
  menuOptions?: DropdownProps["options"];
  menuOptionsHeader?: DropdownProps["header"];
  onEmbedLoaded?: () => void;
  board?: {
    slug: string;
    accentColor: string;
  };
  getOptionsForTag?: (tag: TagsType) => DropdownProps["options"];
  forceHide?: boolean;
  hideFooter?: boolean;
  hideUpdates?: boolean;
  backgroundColor?: string;
  accessory?: AvatarProps["accessory"];
}
