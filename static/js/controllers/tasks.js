var _ = require('underscore');

(function () {

  'use strict';

  var inboxControllers = angular.module('inboxControllers');

  inboxControllers.controller('TasksCtrl',
    ['$timeout', '$scope', '$state', 'TaskGenerator', 'Changes',
    function ($timeout, $scope, $state, TaskGenerator, Changes) {

      $scope.setSelected = function(id) {
        if (id) {
          var refreshing = ($scope.selected && $scope.selected._id) === id;
          $scope.selected = _.findWhere($scope.tasks, { _id: id });
          $scope.settingSelected(refreshing);
        } else if(!$state.params.id &&
                  $scope.tasks.length &&
                  !$('#back').is(':visible')) {
          $timeout(function() {
            var id = $('.inbox-items li').first().attr('data-record-id');
            $state.go('tasks.detail', { id: id });
          });
        } else {
          $scope.clearSelected();
        }
      };

      var updateTasks = function(options) {
        options = options || {};
        if (!options.silent) {
          $scope.loading = true;
        }
        $scope.error = false;
        TaskGenerator()
          .then(function(tasks) {
            $scope.tasks = _.where(tasks, { resolved: false });
            $scope.loading = false;
            $scope.setSelected($state.params.id);
          })
          .catch(function(err) {
            console.log('Error generating tasks', err);
            $scope.loading = false;
            $scope.error = true;
            $scope.tasks = [];
            $scope.clearSelected();
          });
      };

      $scope.$on('ClearSelected', function() {
        $scope.selected = null;
      });

      $scope.setSelectedModule();
      $scope.filterModel.type = 'tasks';
      $scope.tasks = [];
      $scope.selected = null;
      updateTasks();

      Changes({
        key: 'tasks-list',
        callback: function() {
          updateTasks({ silent: true });
        },
        filter: function(change) {
          if ($scope.filterModel.type !== 'tasks') {
            return false;
          }
          if (change.newDoc) {
            return change.newDoc.form;
          }
          return true;
        }
      });
    }
  ]);

}());