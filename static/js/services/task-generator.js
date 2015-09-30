var nools = require('nools'),
    _ = require('underscore'),
    noLmpDateModifier = 4;

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');

  inboxServices.factory('TaskGenerator', ['$q', 'Search', 'Settings',
    function($q, Search, Settings) {

      var getUtils = function(settings) {
        return {
          isTimely: function(date, event) {
            var due = new Date(date);
            var start = this.addDate(null, event.start * -1);
            var end = this.addDate(null, event.end);
            return due.getTime() > start.getTime() && due.getTime() < end.getTime();
          },
          addDate: function(date, days) {
            var result;
            if (date) {
              result = new Date(date.getTime());
            } else {
              result = new Date();
            }
            result.setDate(result.getDate() + days);
            return result;
          },
          getLmpDate: function(doc) {
            var weeks = doc.fields.last_menstrual_period || noLmpDateModifier;
            return this.addDate(new Date(doc.reported_date), weeks * -7);
          },
          getSchedule: function(name) {
            return _.findWhere(settings.tasks.schedules, { name: name });
          }
        };
      };

      var getFlow = function(settings) {
        var flow = nools.getFlow('medic');
        if (flow) {
          return flow;
        }
        var options = {
          name: 'medic',
          scope: { Utils: getUtils(settings) }
        };
        return nools.compile(settings.tasks.rules, options);
      };

      var getDataRecords = function(callback) {
        var scope = {
          filterModel: {
            type: 'reports',
            valid: true,
            forms: [],
            date: {},
            facilities: []
          },
          filterQuery: '',
          forms: [ ]
        };
        var options = { limit: 99999999 };
        Search(scope, options, callback);
      };

      var getGroupId = function(doc) {
        // get the associated patient or place id to group reports by
        return doc.patient_id || doc.place_id ||
          (doc.fields && (doc.fields.patient_id || doc.fields.place_id));
      };

      var groupReports = function(dataRecords) {
        return _.map(dataRecords, function(report) {
          var result = { doc: report, reports: [] };
          var groupId = getGroupId(report);
          if (groupId) {
            result.reports = _.filter(dataRecords, function(r) {
              return r._id !== report._id && getGroupId(r) === groupId;
            });
          }
          return result;
        });
      };

      var getTasks = function(dataRecords, settings, callback) {
        var reports = groupReports(dataRecords);
        var flow = getFlow(settings);
        var Report = flow.getDefined('report');
        var session = flow.getSession();
        var tasks = [];
        session.on('task', function(task) {
          tasks.push(task);
        });
        reports.forEach(function(report) {
          session.assert(new Report(report));
        });
        return session.match().then(
          function() {
            callback(null, tasks);
          },
          callback
        );
      };

      return function() {
        var deferred = $q.defer();
        Settings(function(err, settings) {
          if (err) {
            return deferred.reject(err);
          }
          if (!settings.tasks ||
              !settings.tasks.rules ||
              !settings.tasks.schedules) {
            // no rules or schedules configured
            return deferred.resolve([]);
          }
          getDataRecords(function(err, dataRecords) {
            if (err) {
              return deferred.reject(err);
            }
            getTasks(dataRecords, settings, function(err, tasks) {
              if (err) {
                return deferred.reject(err);
              }
              deferred.resolve(tasks);
            });
          });
        });
        return deferred.promise;
      };
    }
  ]);

}()); 