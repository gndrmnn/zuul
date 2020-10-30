# Copyright 2012 Hewlett-Packard Development Company, L.P.
# Copyright 2013 OpenStack Foundation
# Copyright 2016 Red Hat, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

import logging
import time
from uuid import uuid4

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from zuul.driver import Driver, TriggerInterface
from zuul.driver.timer import timertrigger
from zuul.driver.timer import timermodel
from zuul.driver.timer.timermodel import TimerTriggerEvent
from zuul.lib.logutil import get_annotated_logger


class TimerDriver(Driver, TriggerInterface):
    name = 'timer'
    log = logging.getLogger("zuul.TimerDriver")

    def __init__(self):
        self.apsched = BackgroundScheduler()
        self.apsched.start()
        self.tenant_jobs = {}

    def registerScheduler(self, scheduler):
        self.sched = scheduler

    def reconfigure(self, tenant):
        self._removeJobs(tenant)
        if not self.apsched:
            # Handle possible reuse of the driver without connection objects.
            self.apsched = BackgroundScheduler()
            self.apsched.start()
        self._addJobs(tenant)

    def _removeJobs(self, tenant):
        jobs = self.tenant_jobs.get(tenant.name, [])
        for job in jobs:
            job.remove()

    def _addJobs(self, tenant):
        jobs = []
        self.tenant_jobs[tenant.name] = jobs
        for pipeline in tenant.layout.pipelines.values():
            for ef in pipeline.manager.event_filters:
                if not isinstance(ef.trigger, timertrigger.TimerTrigger):
                    continue
                for timespec in ef.timespecs:
                    parts = timespec.split()
                    if len(parts) < 5 or len(parts) > 7:
                        self.log.error(
                            "Unable to parse time value '%s' "
                            "defined in pipeline %s" % (
                                timespec,
                                pipeline.name))
                        continue
                    minute, hour, dom, month, dow = parts[:5]
                    # default values
                    second = None
                    jitter = None

                    if len(parts) > 5:
                        second = parts[5]
                    if len(parts) > 6:
                        jitter = parts[6]

                    try:
                        jitter = int(jitter) if jitter is not None else None

                        trigger = CronTrigger(day=dom, day_of_week=dow,
                                              hour=hour, minute=minute,
                                              second=second, jitter=jitter)
                    except ValueError:
                        self.log.exception(
                            "Unable to create CronTrigger "
                            "for value '%s' defined in "
                            "pipeline %s",
                            timespec,
                            pipeline.name)
                        continue

                    # The 'misfire_grace_time' argument is set to None to
                    # disable checking if the job missed its run time window.
                    # This ensures we don't miss a trigger when the job is
                    # delayed due to e.g. high scheduler load. Those short
                    # delays are not a problem for our trigger use-case.
                    job = self.apsched.add_job(
                        self._onTrigger, trigger=trigger,
                        args=(tenant, pipeline.name, timespec,),
                        misfire_grace_time=None)
                    jobs.append(job)

    def _onTrigger(self, tenant, pipeline_name, timespec):
        self.log.debug('Got trigger for tenant %s and pipeline %s with '
                       'timespec %s', tenant.name, pipeline_name, timespec)
        for project_name, pcs in tenant.layout.project_configs.items():
            # timer operates on branch heads and doesn't need speculative
            # layouts to decide if it should be enqueued or not.
            # So it can be decided on cached data if it needs to run or not.
            pcst = tenant.layout.getAllProjectConfigs(project_name)
            if not [True for pc in pcst if pipeline_name in pc.pipelines]:
                continue

            (trusted, project) = tenant.getProject(project_name)
            for branch in project.source.getProjectBranches(project, tenant):
                event = TimerTriggerEvent()
                event.type = 'timer'
                event.timespec = timespec
                event.forced_pipeline = pipeline_name
                event.project_hostname = project.canonical_hostname
                event.project_name = project.name
                event.ref = 'refs/heads/%s' % branch
                event.branch = branch
                event.zuul_event_id = str(uuid4().hex)
                event.timestamp = time.time()
                log = get_annotated_logger(self.log, event)
                log.debug("Adding event")
                self.sched.addEvent(event)

    def stop(self):
        if self.apsched:
            self.apsched.shutdown()
            self.apsched = None

    def getTrigger(self, connection_name, config=None):
        return timertrigger.TimerTrigger(self, config)

    def getTriggerSchema(self):
        return timertrigger.getSchema()

    def getTriggerEventClass(self):
        return timermodel.TimerTriggerEvent
