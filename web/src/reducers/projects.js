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

import {
  PROJECTS_FETCH_FAIL,
  PROJECTS_FETCH_REQUEST,
  PROJECTS_FETCH_SUCCESS
} from '../actions/projects'

export default (state = {
  isFetching: false,
  projects: {},
}, action) => {
  switch (action.type) {
    case PROJECTS_FETCH_REQUEST:
      return {
        isFetching: true,
        projects: state.projects,
      }
    case PROJECTS_FETCH_SUCCESS:
      return {
        isFetching: false,
        projects: { ...state.projects, [action.tenant]: action.projects },
      }
    case PROJECTS_FETCH_FAIL:
      return {
        isFetching: false,
        projects: state.projects,
      }
    default:
      return state
  }
}
