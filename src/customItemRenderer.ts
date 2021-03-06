import * as React from 'react';
import { Checkbox, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { actions, ContextMenu, FlexLayout, tooltip, selectors, util } from "vortex-api";
import { IFlexLayoutProps } from 'vortex-api/lib/controls/FlexLayout';
import * as path from 'path';
import { ReactNode } from 'react';
import { IMod, IProfile } from 'vortex-api/lib/types/api';
import { ILoadOrder, ILoadOrderDisplayItem, ILoadOrderEntry } from 'vortex-api/lib/extensions/mod_load_order/types/types';

import { getValidationInfo } from './utils';

//const { dynreq } = require('vortex-run');


const TWLOGO = path.join(__dirname, 'TWLogo.png');

class CustomItemRenderer extends React.Component {
  mMounted: boolean;

  //props: Readonly<{ item; order; mods; className; }>;
  readonly props: Readonly<{
    children?: ReactNode;
    item: ILoadOrderDisplayItem;
    order: ILoadOrder;
    mods: { [id: string]: IMod; };
    className: string;
    modsPath: string;
    installPath: string;
    profile: IProfile;
    onSetLoadOrderEntry: (profileId: string, itemId: string, entry: ILoadOrderEntry) => void;
    onRef: (ref: any) => any;
  }>;

  state: Readonly<{
    contextMenuVisible: boolean;
    offset: {
      x: number;
      y: number
    };
  }>;

  constructor(props: {} | Readonly<{}>) {
    super(props);
    this.state = {
      contextMenuVisible: false,
      offset: { x: 0, y: 0 },
    }
    this.mMounted = false;
  }

  componentDidMount() {
    this.mMounted = true;
  }

  componentWillUnmount() {
    this.mMounted = false;
  }

  renderAddendum(props: Readonly<{ item: ILoadOrderDisplayItem; order: ILoadOrder; mods: { [id: string]: IMod; }; modsPath: string; installPath: string; }>) {
    // Extra stuff we want to add to the LO entry.
    //  Currently renders the open directory button for
    const { item, order, mods } = props;
    const managedModKeys = Object.keys(mods);
    const isLocked = !!order[item.id]?.locked;

    const renderLock = () => {
      return React.createElement(tooltip.Icon, { name: 'locked', tooltip: 'Entry is locked in position' });
    }

    const renderInfo = () => {
      return React.createElement(tooltip.Icon, { name: 'dialog-info', tooltip: 'Not managed by Vortex' });
    }

    return (this.isItemInvalid(item))
      ? this.renderOpenDirButton(props)
      : (isLocked)
        ? renderLock()
        : !managedModKeys.includes(item.id)
          ? renderInfo()
          : null
  }

  // TODO: move all style configuration into a stylesheet
  renderOfficialEntry(item: ILoadOrderDisplayItem) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center' } }, 
      React.createElement('img', {
      src: TWLOGO,
      className: 'official-submodule-logo',
      style: {
        width:'1.5em',
        height:'1.5em',
        marginRight:'5px',
      },
    }),
    React.createElement('p', {}, item.name));
  }

  renderEntry(props: Readonly<{ profile: IProfile; order: ILoadOrder; item: ILoadOrderDisplayItem; onSetLoadOrderEntry: (profileId: string, itemId: string, entry: ILoadOrderEntry) => void; }>) {
    const { item, order } = props;
    const isEnabled = !!order[item.id]?.locked || order[item.id].enabled;
    return React.createElement(Checkbox, {
      checked: isEnabled,
      disabled: !!item?.locked,
      onChange: (evt) => this.onStatusChange(evt, props)}, item.name);
  }

  renderInvalidEntry(item: ILoadOrderDisplayItem): React.CElement<Checkbox.CheckboxProps, Checkbox> {
    const invalidReason = this.itemInvalidReason(item);
    const reasonElement = () => (invalidReason !== undefined) 
      ? React.createElement(tooltip.Icon, { style: {color: 'red'}, name: 'feedback-error', tooltip: invalidReason })
      : null;
    return React.createElement(Checkbox, {
      checked: false,
      disabled: true }, item.name, ' ', reasonElement());
  }

  onLock(props: { profile: IProfile; order: ILoadOrder; item: ILoadOrderDisplayItem; onSetLoadOrderEntry: (profileId: string, itemId: string, entry: ILoadOrderEntry) => void; }, lock: boolean) {
    const { profile, order, item, onSetLoadOrderEntry } = props;
    const entry = {
      pos: order[item.id].pos,
      enabled: order[item.id].enabled,
      locked: lock,
    } as ILoadOrderEntry

    onSetLoadOrderEntry(profile.id, item.id, entry);
  }

  renderContextMenu(state: Readonly<{ contextMenuVisible: boolean; offset: { x: number; y: number; }; }>, props: { profile: IProfile; order: ILoadOrder; item: ILoadOrderDisplayItem; onSetLoadOrderEntry: (profileId: string, itemId: string, entry: ILoadOrderEntry) => void; }) {
    const { order, item } = props;
    const { contextMenuVisible, offset } = state;
    return React.createElement(ContextMenu, {
      key: 'mnb2-context-menu',
      position: offset,
      visible: !!contextMenuVisible,
      onHide: () => {
        if (this.mMounted) {
          this.setState({ contextMenuVisible: false });
        }
      },
      instanceId: item.id,
      actions: [
        { title: 'Lock', show: (order[item.id]?.locked === false), action: () => this.onLock(props, true) },
        { title: 'Unlock', show: !!order[item.id]?.locked, action: () => this.onLock(props, false) },
      ],
    })
  }

  render() {
    const { order, className, item } = this.props;
    const position = (item.prefix !== undefined)
      ? item.prefix
      : order[item.id].pos + 1;

    let classes = ['load-order-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    const key = `${item.name}-${position}`;
    const result = React.createElement(ListGroupItem, {
      className: 'load-order-entry',
      ref: (ref) => this.setRef(ref, this.props),
      key,
      style: { height: '48px' },
      onContextMenu: (evt) => {
        return this.setState({
          contextMenuVisible: !this.state.contextMenuVisible,
          offset: { x: evt.clientX, y: evt.clientY },
        });
      },
    },
    React.createElement(FlexLayout, { type: 'row', height: '20px' } as IFlexLayoutProps,
      React.createElement(FlexLayout.Flex, {
        style: {
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          height: '20px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }
      }, (this.isItemInvalid(item))
        ? this.renderInvalidEntry(item)
        : (item.official)
          ? this.renderOfficialEntry(item)
          : this.renderEntry(this.props)
        ),
      React.createElement(FlexLayout.Flex, {
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
        }
      }, this.renderAddendum(this.props)), this.renderContextMenu(this.state, this.props)));
    return result;
  }

  isItemInvalid(item: ILoadOrderDisplayItem): boolean {
    const indexPath = path.join(__dirname, 'index.js');
    //const validFunc = dynreq(indexPath).getValidationInfo;
    const validFunc = getValidationInfo;
    const infoObj = validFunc(item.id);
    return ((infoObj.missing.length > 0) || (infoObj.cyclic.length > 0));
  }

  itemInvalidReason(item: ILoadOrderDisplayItem): string | undefined {
    const indexPath = path.join(__dirname, 'index.js');
    //const validFunc = dynreq(indexPath).getValidationInfo;
    const validFunc = getValidationInfo;
    const infoObj = validFunc(item.id);

    if (infoObj.missing.length > 0) {
      // This mod is missing a dependency, that's
      //  somewhat more pressing at the moment.
      return `Missing dependencies: ${infoObj.missing.join(';')}`;
    }

    if (infoObj.cyclic.length > 0) {
      return `Cyclic dependencies: ${infoObj.cyclic.join(';')}`;
    }

    return undefined;
  }

  renderOpenDirButton(props: Readonly<{ item: ILoadOrderDisplayItem; mods: { [id: string]: IMod; }; modsPath: string; installPath: string; }>) {
    const { item, mods, modsPath, installPath } = props;
    const managedModKeys = Object.keys(mods);
    const itemPath = managedModKeys.includes(item.id)
      ? path.join(installPath, mods[item.id].installationPath)
      : path.join(modsPath, 'Modules', item.id);
    return React.createElement(tooltip.IconButton, {
      icon: 'open-ext',
      tooltip: 'Open path',
      className: 'btn-embed btn-dismiss',
      onClick: () => util.opn(itemPath).catch(err => null) });
  }

  onStatusChange(evt, props: { profile: IProfile; order: ILoadOrder; item: ILoadOrderDisplayItem; onSetLoadOrderEntry: (profileId: string, itemId: string, entry: ILoadOrderEntry) => void; }) {
    const { profile, order, item, onSetLoadOrderEntry } = props;
    const entry = {
      pos: order[item.id].pos,
      enabled: evt.target.checked,
      locked: order[item.id]?.locked !== undefined ? order[item.id].locked : false,
    }

    onSetLoadOrderEntry(profile.id, item.id, entry);
  }

  setRef (ref: any, props: Readonly<{ onRef: (ref: any) => any; }>) {
    return props.onRef(ref);
  }
}

/*
function mapStateToProps(state: any) {
  const profile = selectors.activeProfile(state);
  const game = util.getGame(profile.gameId);
  const discovery = selectors.discoveryByGame(state, profile.gameId);
  const modsPath = game.getModPaths(discovery.path)[''];
  const installPath = selectors.installPathForGame(state, profile.gameId);
  return {
    profile,
    modsPath,
    installPath,
    mods: util.getSafe(state, ['persistent', 'mods', profile.gameId], {}),
    order: util.getSafe(state, ['persistent', 'loadOrder', profile.id], []),
  };
}

function mapDispatchToProps(dispatch: (arg0: any) => any) {
  return {
    onSetLoadOrderEntry: (profileId: string, modId: string, entry: ILoadOrderEntry) =>
      dispatch(actions.setLoadOrderEntry(profileId, modId, entry)),
    onSetDeploymentRequired: () =>
      dispatch(actions.setDeploymentNecessary('mountandblade2bannerlord', true)),
  };
}
*/

export default CustomItemRenderer;