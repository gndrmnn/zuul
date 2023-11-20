// Copyright 2018 Red Hat, Inc
// Copyright 2023 Acme Gating, LLC
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

import * as React from 'react'
import { isEqual } from 'lodash'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import {
  Icon
} from 'patternfly-react'
import {
  PageSection,
  PageSectionVariants,
  Pagination,
} from '@patternfly/react-core'

import { fetchConfigErrors } from '../api'
import {
  makeQueryString,
  FilterToolbar,
  getFiltersFromUrl,
  writeFiltersToUrl,
} from '../containers/FilterToolbar'
import ConfigErrorTable from '../containers/configerrors/ConfigErrorTable'

class ConfigErrorsPage extends React.Component {
  static propTypes = {
    configErrors: PropTypes.array,
    configErrorsReady: PropTypes.bool,
    tenant: PropTypes.object,
    dispatch: PropTypes.func,
    preferences: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object,
    timezone: PropTypes.string,
  }

  constructor(props) {
    super()
    this.filterCategories = [
      {
        key: 'project',
        title: 'Project',
        placeholder: 'Filter by project...',
        type: 'search',
      },
      {
        key: 'branch',
        title: 'Branch',
        placeholder: 'Filter by branch...',
        type: 'search',
      },
      {
        key: 'severity',
        title: 'Severity',
        placeholder: 'Filter by severity...',
        type: 'search',
      },
      {
        key: 'name',
        title: 'Name',
        placeholder: 'Filter by name...',
        type: 'search',
      },
    ]

    const _filters = getFiltersFromUrl(props.location, this.filterCategories)
    const perPage = _filters.limit[0]
      ? parseInt(_filters.limit[0])
      : 50
    const currentPage = _filters.skip[0]
      ? Math.floor(parseInt(_filters.skip[0] / perPage)) + 1
      : 1
    this.state = {
      errors: [],
      fetching: false,
      filters: _filters,
      resultsPerPage: perPage,
      currentPage: currentPage,
      itemCount: null,
    }
  }

  componentDidMount () {
    document.title = 'Zuul Configuration Errors'
    if (this.props.tenant.name) {
      this.updateData(this.state.filters)
    }
  }

  componentDidUpdate (prevProps) {
    if (
      this.props.tenant.name !== prevProps.tenant.name ||
      this.props.timezone !== prevProps.timezone
    ) {
      this.updateData(this.state.filters)
    }
  }

  updateData = (filters) => {
    // When building the filter query for the API we can't rely on the location
    // search parameters. Although, we've updated them in theu URL directly
    // they always have the same value in here (the values when the page was
    // first loaded). Most probably that's the case because the location is
    // passed as prop and doesn't change since the page itself wasn't
    // re-rendered.
    const { itemCount } = this.state
    let paginationOptions = {
      skip: filters.skip.length > 0 ? filters.skip : [0,],
      limit: filters.limit.length > 0 ? filters.limit : [50,]
    }
    let _filters = { ...filters, ...paginationOptions }
    const queryString = makeQueryString(_filters)
    this.setState({ fetching: true })
    // TODO (felix): What happens in case of a broken network connection? Is the
    // fetching shows infinitely or can we catch this and show an erro state in
    // the table instead?
    fetchConfigErrors(this.props.tenant.apiPrefix, queryString).then((response) => {
      // if we have already an itemCount for this query (ie we're scrolling backwards through results)
      // keep this value. Otherwise, check if we've got all the results.
      let finalItemCount = itemCount
        ? itemCount
        : (response.data.length < paginationOptions.limit[0]
          ? parseInt(paginationOptions.skip[0]) + response.data.length
          : null)
      this.setState({
        errors: response.data,
        fetching: false,
        itemCount: finalItemCount,
      })
    })
  }

  filterInputValidation = (filterKey, filterValue) => {
    // Input value should not be empty for all cases
    if (!filterValue) {
      return {
        success: false,
        message: 'Input should not be empty'
      }
    }

    return {
      success: true
    }
  }

  handleFilterChange = (newFilters) => {
    const { location, history } = this.props
    const { filters, itemCount } = this.state
    /*eslint no-unused-vars: ["error", { "ignoreRestSiblings": true }]*/
    let { 'skip': x1, 'limit': y1, ..._oldFilters } = filters
    let { 'skip': x2, 'limit': y2, ..._newFilters } = newFilters

    // If filters have changed, reinitialize skip
    let equalTest = isEqual(_oldFilters, _newFilters)
    let finalFilters = equalTest ? newFilters : { ...newFilters, skip: [0,] }

    // We must update the URL parameters before the state. Otherwise, the URL
    // will always be one filter selection behind the state. But as the URL
    // reflects our state this should be ok.
    writeFiltersToUrl(finalFilters, location, history)
    let newState = {
      filters: finalFilters,
      // if filters haven't changed besides skip or limit, keep our itemCount and currentPage
      itemCount: equalTest ? itemCount : null,
    }
    if (!equalTest) {
      newState.currentPage = 1
    }
    this.setState(
      newState,
      () => {
        this.updateData(finalFilters)
      })
  }

  handleClearFilters = () => {
    // Delete the values for each filter category
    const filters = this.filterCategories.reduce((filterDict, category) => {
      filterDict[category.key] = []
      return filterDict
    }, {})
    this.handleFilterChange(filters)
  }

  handlePerPageSelect = (event, perPage) => {
    const { filters } = this.state
    this.setState({ resultsPerPage: perPage })
    const newFilters = { ...filters, limit: [perPage,] }
    this.handleFilterChange(newFilters)
  }

  handleSetPage = (event, pageNumber) => {
    const { filters, resultsPerPage } = this.state
    this.setState({ currentPage: pageNumber })
    let offset = resultsPerPage * (pageNumber - 1)
    const newFilters = { ...filters, skip: [offset,] }
    this.handleFilterChange(newFilters)
  }

  render () {
    const { history } = this.props
    const { errors, fetching, filters, resultsPerPage, currentPage, itemCount } = this.state

    return (
      <PageSection variant={this.props.preferences.darkMode ? PageSectionVariants.dark : PageSectionVariants.light}>
        <div className="pull-right">
          {/* Lint warning jsx-a11y/anchor-is-valid */}
          {/* eslint-disable-next-line */}
          <a className="refresh" onClick={() => {this.updateData(filters)}}>
            <Icon type="fa" name="refresh" /> refresh&nbsp;&nbsp;
          </a>
        </div>
        <FilterToolbar
          filterCategories={this.filterCategories}
          onFilterChange={this.handleFilterChange}
          filters={filters}
          filterInputValidation={this.filterInputValidation}
        />
        <Pagination
          toggleTemplate={({ firstIndex, lastIndex, itemCount }) => (
            <React.Fragment>
              <b>
                {firstIndex} - {lastIndex}
              </b>
              &nbsp;
              of
              &nbsp;
              <b>{itemCount ? itemCount : 'many'}</b>
            </React.Fragment>
          )}
          itemCount={itemCount}
          perPage={resultsPerPage}
          page={currentPage}
          widgetId="pagination-menu"
          onPerPageSelect={this.handlePerPageSelect}
          onSetPage={this.handleSetPage}
          isCompact
        />
        <ConfigErrorTable
          errors={errors}
          fetching={fetching}
          onClearFilters={this.handleClearFilters}
          history={history}
        />
      </PageSection>
    )
  }
}

export default connect(state => ({
  tenant: state.tenant,
  preferences: state.preferences,
}))(ConfigErrorsPage)
