// Copyright 2018 Red Hat, Inc
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

// The App is the parent component of every pages. Each page content is
// rendered by the Route object according to the current location.

import React from 'react'
import PropTypes from 'prop-types'
import { matchPath, withRouter } from 'react-router'
import { Link, NavLink, Redirect, Route, Switch } from 'react-router-dom'
import { connect } from 'react-redux'
import {
  TimedToastNotification,
  ToastNotificationList,
} from 'patternfly-react'
import * as moment from 'moment'
import {
  Brand,
  Button,
  ButtonVariant,
  Dropdown,
  DropdownItem,
  KebabToggle,
  Modal,
  Nav,
  NavItem,
  NavList,
  NotificationBadge,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
  Page,
  PageHeader,
  PageHeaderTools,
  PageHeaderToolsGroup,
  PageHeaderToolsItem,
} from '@patternfly/react-core'

import {
  BellIcon,
  BookIcon,
  CodeIcon,
  ServiceIcon,
  UsersIcon,
} from '@patternfly/react-icons'

import AuthContainer from './containers/auth/Auth'
import ErrorBoundary from './containers/ErrorBoundary'
import { Fetching } from './containers/Fetching'
import SelectTz from './containers/timezone/SelectTz'
import ConfigModal from './containers/config/Config'
import logo from './images/logo.svg'
import { clearNotification } from './actions/notifications'
import { fetchConfigErrorsAction } from './actions/configErrors'
import { routes } from './routes'
import { setTenantAction } from './actions/tenant'
import { configureAuthFromTenant, configureAuthFromInfo } from './actions/auth'
import { getHomepageUrl } from './api'
import AuthCallbackPage from './pages/AuthCallback'

class App extends React.Component {
  static propTypes = {
    notifications: PropTypes.array,
    configErrors: PropTypes.array,
    info: PropTypes.object,
    tenant: PropTypes.object,
    timezone: PropTypes.string,
    location: PropTypes.object,
    history: PropTypes.object,
    dispatch: PropTypes.func,
    isKebabDropdownOpen: PropTypes.bool,
    user: PropTypes.object,
    auth: PropTypes.object,
  }

  state = {
    showErrors: false,
  }

  renderMenu() {
    const { tenant } = this.props
    if (tenant.name) {
      return (
        <Nav aria-label="Nav" variant="horizontal">
          <NavList>
            {this.menu.filter(item => item.title).map(item => (
              <NavItem itemId={item.to} key={item.to}>
                <NavLink
                  to={tenant.linkPrefix + item.to}
                  activeClassName="pf-c-nav__link pf-m-current"
                >
                  {item.title}
                </NavLink>
              </NavItem>
            ))}
          </NavList>
        </Nav>
      )
    } else {
      // Return an empty navigation bar in case we don't have an active tenant
      return <Nav aria-label="Nav" variant="horizontal" />
    }
  }

  renderContent = () => {
    const { info, tenant, auth } = this.props
    const allRoutes = []

    if ((window.location.origin + window.location.pathname) ===
        (getHomepageUrl() + 'auth_callback')) {
      // Sit on the auth callback page until login and token
      // validation is complete (it will internally redirect when complete)
      return <AuthCallbackPage/>
    }
    if (info.isFetching || !auth.info || auth.isFetching) {
      return <Fetching />
    }
    this.menu
      // Do not include '/tenants' route in white-label setup
      .filter(item =>
        (tenant.whiteLabel && !item.globalRoute) || !tenant.whiteLabel)
      .forEach((item, index) => {
        // We use react-router's render function to be able to pass custom props
        // to our route components (pages):
        // https://reactrouter.com/web/api/Route/render-func
        // https://learnwithparam.com/blog/how-to-pass-props-in-react-router/
        allRoutes.push(
          <Route
            key={index}
            path={
              item.globalRoute ? item.to :
                item.noTenantPrefix ? item.to : tenant.routePrefix + item.to}
            render={routerProps => (
              <item.component {...item.props} {...routerProps} />
            )}
            exact
          />
        )
      })
    if (tenant.defaultRoute)
      allRoutes.push(
        <Redirect from='*' to={tenant.defaultRoute} key='default-route' />
      )
    return (
      <Switch>
        {allRoutes}
      </Switch>
    )
  }

  componentDidUpdate() {
    // This method is called when info property is updated
    const { tenant, info } = this.props
    if (info.ready) {
      let tenantName, whiteLabel

      if (info.tenant) {
        // White label
        whiteLabel = true
        tenantName = info.tenant
      } else if (!info.tenant) {
        // Multi tenant, look for tenant name in url
        whiteLabel = false

        const match = matchPath(
          this.props.location.pathname, { path: '/t/:tenant' })

        if (match) {
          tenantName = match.params.tenant
        }
      }
      // Set tenant only if it changed to prevent DidUpdate loop
      if (tenant.name !== tenantName) {
        const tenantAction = setTenantAction(tenantName, whiteLabel)
        this.props.dispatch(tenantAction)
        if (tenantName) {
          this.props.dispatch(fetchConfigErrorsAction(tenantAction.tenant))
        }
        if (whiteLabel || !tenantName) {
          // The app info endpoint was already a tenant info
          // endpoint, so auth info was already provided.
          this.props.dispatch(configureAuthFromInfo(info))
        } else {
          // Query the tenant info endpoint for auth info.
          this.props.dispatch(configureAuthFromTenant(tenantName))
        }
      }
    }
  }

  constructor() {
    super()
    this.menu = routes()
  }

  handleKebabDropdownToggle = (isKebabDropdownOpen) => {
    this.setState({
      isKebabDropdownOpen
    })
  }

  handleKebabDropdownSelect = () => {
    this.setState({
      isKebabDropdownOpen: !this.state.isKebabDropdownOpen
    })
  }

  handleComponentsLink = () => {
    const { history } = this.props
    history.push('/components')
  }

  handleApiLink = () => {
    const { history } = this.props
    history.push('/openapi')
  }

  handleDocumentationLink = () => {
    window.open('https://zuul-ci.org/docs', '_blank', 'noopener noreferrer')
  }

  handleTenantLink = () => {
    const { history, tenant } = this.props
    history.push(tenant.defaultRoute)
  }

  handleModalClose = () => {
    this.setState({
      showErrors: false
    })
  }

  renderNotifications = (notifications) => {
    return (
      <ToastNotificationList>
        {notifications.map(notification => {
          let notificationBody
          if (notification.type === 'error') {
            notificationBody = (
              <>
                <strong>{notification.text}</strong> {notification.status} &nbsp;
                {notification.url}
              </>
            )
          } else {
            notificationBody = (<span>{notification.text}</span>)
          }
          return (
            <TimedToastNotification
              key={notification.id}
              type={notification.type}
              onDismiss={() => { this.props.dispatch(clearNotification(notification.id)) }}
            >
              <span title={moment.utc(notification.date).tz(this.props.timezone).format()}>
                {notificationBody}
              </span>
            </TimedToastNotification>
          )
        }
        )}
      </ToastNotificationList>
    )
  }

  renderConfigErrors = (configErrors) => {
    const { history } = this.props
    const { showErrors } = this.state
    const errors = []
    configErrors.forEach((item, idx) => {
      let error = item.error
      let cookie = error.indexOf('The error was:')
      if (cookie !== -1) {
        error = error.slice(cookie + 18).split('\n')[0]
      }
      let ctxPath = item.source_context.path
      if (item.source_context.branch !== 'master') {
        ctxPath += ' (' + item.source_context.branch + ')'
      }
      errors.push(
        <NotificationDrawerListItem
          key={idx}
          variant="danger"
          onClick={() => {
            history.push(this.props.tenant.linkPrefix + '/config-errors')
            this.setState({ showErrors: false })
          }}
        >
          <NotificationDrawerListItemHeader
            title={item.source_context.project + ' | ' + ctxPath}
            variant="danger" />
          <NotificationDrawerListItemBody>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </pre>
          </NotificationDrawerListItemBody>
        </NotificationDrawerListItem>
      )
    })

    return (
      <Modal
        isOpen={showErrors}
        onClose={this.handleModalClose}
        aria-label="Config Errors"
        header={
          <>
            <span className="zuul-config-errors-title">
              Config Errors
            </span>
            <span className="zuul-config-errors-count">
              {errors.length} error(s)
            </span>
          </>
        }
      >
        <NotificationDrawer>
          <NotificationDrawerBody>
            <NotificationDrawerList>
              {errors.map(item => (item))}
            </NotificationDrawerList>
          </NotificationDrawerBody>
        </NotificationDrawer>
      </Modal>
    )
  }

  render() {
    const { isKebabDropdownOpen } = this.state
    const { notifications, configErrors, tenant, info, auth } = this.props

    const nav = this.renderMenu()

    const kebabDropdownItems = []
    if (!info.tenant) {
      kebabDropdownItems.push(
        <DropdownItem
          key="components"
          onClick={event => this.handleComponentsLink(event)}
        >
          <ServiceIcon /> Components
        </DropdownItem>
      )
    }

    kebabDropdownItems.push(
      <DropdownItem key="api" onClick={event => this.handleApiLink(event)}>
        <CodeIcon /> API
      </DropdownItem>
    )
    kebabDropdownItems.push(
      <DropdownItem
        key="documentation"
        onClick={event => this.handleDocumentationLink(event)}
      >
        <BookIcon /> Documentation
      </DropdownItem>
    )

    if (tenant.name) {
      kebabDropdownItems.push(
        <DropdownItem
          key="tenant"
          onClick={event => this.handleTenantLink(event)}
        >
          <UsersIcon /> Tenant
        </DropdownItem>
      )
    }

    const pageHeaderTools = (
      <PageHeaderTools>
        {/* The utility navbar is only visible on desktop sizes
            and replaced by a kebab dropdown for smaller sizes */}
        <PageHeaderToolsGroup
          visibility={{ default: 'hidden', lg: 'visible' }}
        >
          { (!info.tenant) &&
            <PageHeaderToolsItem>
              <Link to='/components'>
                <Button variant={ButtonVariant.plain}>
                  <ServiceIcon /> Components
                </Button>
              </Link>
            </PageHeaderToolsItem>
          }
          <PageHeaderToolsItem>
            <Link to='/openapi'>
              <Button variant={ButtonVariant.plain}>
                <CodeIcon /> API
              </Button>
            </Link>
          </PageHeaderToolsItem>
          <PageHeaderToolsItem>
            <a
              href='https://zuul-ci.org/docs'
              rel='noopener noreferrer'
              target='_blank'
            >
              <Button variant={ButtonVariant.plain}>
                <BookIcon /> Documentation
              </Button>
            </a>
          </PageHeaderToolsItem>
          {tenant.name && (
            <PageHeaderToolsItem>
              <Link to={tenant.defaultRoute}>
                <Button variant={ButtonVariant.plain}>
                  <strong>Tenant</strong> {tenant.name}
                </Button>
              </Link>
            </PageHeaderToolsItem>
          )}
        </PageHeaderToolsGroup>
        <PageHeaderToolsGroup>
          {/* this kebab dropdown replaces the icon buttons and is hidden for
              desktop sizes */}
          <PageHeaderToolsItem visibility={{ lg: 'hidden' }}>
            <Dropdown
              isPlain
              position="right"
              onSelect={this.handleKebabDropdownSelect}
              toggle={<KebabToggle onToggle={this.handleKebabDropdownToggle} />}
              isOpen={isKebabDropdownOpen}
              dropdownItems={kebabDropdownItems}
            />
          </PageHeaderToolsItem>
        </PageHeaderToolsGroup>
        {configErrors.length > 0 &&
          <NotificationBadge
            isRead={false}
            aria-label="Notifications"
            onClick={(e) => {
              e.preventDefault()
              this.setState({ showErrors: !this.state.showErrors })
            }}
          >
            <BellIcon />
          </NotificationBadge>
        }
        <SelectTz />
        <ConfigModal />

        {auth.info && auth.info.default_realm && (<AuthContainer />)}
      </PageHeaderTools>
    )

    // In case we don't have an active tenant, fall back to the root URL
    const logoUrl = tenant.name ? tenant.defaultRoute : '/'
    const pageHeader = (
      <PageHeader
        logo={<Brand src={logo} alt='Zuul logo' />}
        logoProps={{ to: logoUrl }}
        logoComponent={Link}
        headerTools={pageHeaderTools}
      />
    )

    return (
      <React.Fragment>
        {notifications.length > 0 && this.renderNotifications(notifications)}
        {this.renderConfigErrors(configErrors)}
        <Page className="zuul-page" header={pageHeader} tertiaryNav={nav}>
          <ErrorBoundary>
            {this.renderContent()}
          </ErrorBoundary>
        </Page>
      </React.Fragment>
    )
  }
}

// This connect the info state from the store to the info property of the App.
export default withRouter(connect(
  state => ({
    notifications: state.notifications,
    configErrors: state.configErrors,
    info: state.info,
    tenant: state.tenant,
    timezone: state.timezone,
    user: state.user,
    auth: state.auth,
  })
)(App))
