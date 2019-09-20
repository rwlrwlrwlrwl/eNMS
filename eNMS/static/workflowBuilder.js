/*
global
action: false
alertify: false
call: false
createPanel: false
fCall: false
normalRun: false
runLogic: false
showLogsPanel: false
showPanel: false
showResultsPanel: false
showTypePanel: false
userIsActive: true
vis: false
workflow: true
workflowRunMode: false
*/

const container = document.getElementById("network");
const dsoptions = {
  edges: {
    font: {
      size: 12,
    },
  },
  nodes: {
    shape: "box",
    font: {
      bold: {
        color: "#0077aa",
      },
    },
  },
  interaction: {
    hover: true,
    hoverConnectedEdges: false,
    multiselect: true,
  },
  manipulation: {
    enabled: false,
    addNode: function(data, callback) {},
    addEdge: function(data, callback) {
      if (data.to == 1) {
        alertify.notify("You cannot draw an edge to 'Start'.", "error", 5);
      }
      if (data.from == 2) {
        alertify.notify("You cannot draw an edge from 'End'.", "error", 5);
      }
      if (data.from != data.to) {
        data.subtype = edgeType;
        saveEdge(data);
      }
    },
  },
};

let nodes;
let edges;
let graph;
let selectedObject;
let edgeType;
let mousePosition;
let currLabel;
let arrowHistory = [];
let arrowPointer = -1;
let currentRuntime;

function displayWorkflow(workflowData) {
  workflow = workflowData.workflow;
  nodes = new vis.DataSet(workflow.jobs.map(jobToNode));
  edges = new vis.DataSet(workflow.edges.map(edgeToEdge));
  workflow.jobs
    .filter((s) => s.type == "IterationService")
    .map(drawIterationService);
  workflow.jobs.filter((s) => s.iteration_values != "").map(drawIterationEdge);
  for (const [id, label] of Object.entries(workflow.labels)) {
    drawLabel(id, label);
  }
  graph = new vis.Network(container, { nodes: nodes, edges: edges }, dsoptions);
  graph.setOptions({ physics: false });
  /*
  graph.on("afterDrawing", function (ctx) {
    let pos = graph.getPositions(1);
    positions = graph.canvasToDOM({x: pos[1].x, y: pos[1].y});
    $("#test").css({
      top: positions.y,
      left: positions.x - 150,
      position:'relative'
    });
  });
  */
  graph.on("oncontext", function(properties) {
    // eslint-disable-next-line new-cap
    mousePosition = graph.DOMtoCanvas({
      x: properties.event.offsetX,
      y: properties.event.offsetY,
    });
    properties.event.preventDefault();
    const node = this.getNodeAt(properties.pointer.DOM);
    const edge = this.getEdgeAt(properties.pointer.DOM);
    if (typeof node !== "undefined" && node != 1 && node != 2) {
      graph.selectNodes([node]);
      $(".menu-entry ").hide();
      $(`.${node.length == 36 ? "label" : "node"}-selection`).show();
      selectedObject = nodes.get(node);
    } else if (typeof edge !== "undefined" && node != 1 && node != 2) {
      graph.selectEdges([edge]);
      $(".menu-entry ").hide();
      $(".edge-selection").show();
      selectedObject = edges.get(edge);
    } else {
      $(".menu-entry ").hide();
      $(".global").show();
    }
  });
  graph.on("doubleClick", function(properties) {
    properties.event.preventDefault();
    let node = this.getNodeAt(properties.pointer.DOM);
    if (node) {
      node = parseInt(node);
      const job = workflow.jobs.find((w) => w.id === node);
      if (job.type == "Workflow") {
        switchToWorkflow(node);
        $("#current-workflow").val(node);
        $("#current-workflow").selectpicker("refresh");
      } else {
        showTypePanel(job.type, job.id);
      }
    }
  });
  $("#current-runtimes").empty();
  $("#current-runtimes").append(
    "<option value='normal'>Normal Display</option>"
  );
  $("#current-runtimes").append(
    "<option value='latest'>Latest Runtime</option>"
  );
  workflowData.runtimes.forEach((runtime) => {
    $("#current-runtimes").append(
      `<option value='${runtime[0]}'>${runtime[0]} (run by ${
        runtime[1]
      })</option>`
    );
  });
  $("#current-runtimes").val("latest");
  $("#current-workflow").val(workflow.id);
  $("#current-runtimes,#current-workflow").selectpicker("refresh");
  graph.on("dragEnd", (event) => {
    if (graph.getNodeAt(event.pointer.DOM)) savePositions();
  });
  $(`#add_jobs option[value='${workflow.id}']`).remove();
  $("#add_jobs").selectpicker("refresh");
  displayWorkflowState(workflowData);
  rectangleSelection($("#network"), graph, nodes);
  return graph;
}

const rectangleSelection = (container, network, nodes) => {

  const offsetLeft = container.position().left - container.offset().left
  const offsetTop = container.position().top - container.offset().top
  let drag = false
  let DOMRect = {};

  const canvasify = (DOMx, DOMy) => {
      const { x, y } = network.DOMtoCanvas({ x: DOMx, y: DOMy });
      return [x, y];
  };

  const correctRange = (start, end) =>
      start < end ? [start, end] : [end, start];

  const selectFromDOMRect = () => {
    const [sX, sY] = canvasify(DOMRect.startX, DOMRect.startY);
    const [eX, eY] = canvasify(DOMRect.endX, DOMRect.endY);
    const [startX, endX] = correctRange(sX, eX);
    const [startY, endY] = correctRange(sY, eY);

    network.selectNodes(nodes.get().reduce(
      (selected, { id }) => {
        const { x, y } = network.getPositions(id)[id];
        return (startX <= x && x <= endX && startY <= y && y <= endY) ?
          selected.concat(id) : selected;
      }, []
    ));
  }

  container.on("mousedown", function({ which, pageX, pageY }) {
    if (which === 3) {
      console.log(this.offsetLeft, this.offsetTop)
        Object.assign(DOMRect, {
          startX: pageX - this.offsetLeft + offsetLeft,
          startY: pageY - this.offsetTop + offsetTop,
          endX: pageX - this.offsetLeft + offsetLeft,
          endY: pageY - this.offsetTop + offsetTop
        });
        drag = true;
    }
  });

  container.on("mousemove", function({ which, pageX, pageY }) {
      if (which === 0 && drag) {
          drag = false;
          network.redraw();
      } else if (drag) {
        Object.assign(DOMRect, {
          endX: pageX - this.offsetLeft + offsetLeft,
          endY: pageY - this.offsetTop + offsetTop
        });
        network.redraw();
      }
  });

  container.on("mouseup", function({ which }) {
    if(which === 3) {
      drag = false;
      network.redraw();
      selectFromDOMRect();
    }

  network.on('afterDrawing', ctx => {
    if(drag) {
      const [startX, startY] = canvasify(DOMRect.startX, DOMRect.startY);
      const [endX, endY] = canvasify(DOMRect.endX, DOMRect.endY);
      ctx.setLineDash([5]);
      ctx.strokeStyle = 'rgba(78, 146, 237, 0.75)';
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(151, 194, 252, 0.45)';
      ctx.fillRect(startX, startY, endX - startX, endY - startY);
    }
  });
}

function switchToWorkflow(workflowId, arrow) {
  if (!arrow) {
    arrowPointer++;
    arrowHistory.splice(arrowPointer, 9e9, workflowId);
  } else {
    arrowPointer += arrow == "right" ? 1 : -1;
  }
  if (arrowHistory.length >= 1 && arrowPointer !== 0) {
    $("#left-arrow").show();
  } else {
    $("#left-arrow").hide();
  }
  if (arrowPointer < arrowHistory.length - 1) {
    $("#right-arrow").show();
  } else {
    $("#right-arrow").hide();
  }
  call(`/get_workflow_state/${workflowId}/latest`, function(result) {
    workflow = result.workflow;
    graph = displayWorkflow(result);
    alertify.notify(`Workflow '${workflow.name}' displayed.`, "success", 5);
  });
}

// eslint-disable-next-line
function saveWorkflowJob(job, update) {
  if (update) {
    nodes.update(jobToNode(job));
    let jobIndex = workflow.jobs.findIndex((job) => job.id == job.id);
    workflow.jobs[jobIndex] = job;
  } else {
    addJobsToWorkflow([job.id]);
  }
  if (job.iteration_values != "") {
    drawIterationEdge(job);
  } else {
    edges.remove(-job.id);
  }
}

// eslint-disable-next-line
function saveWorkflowEdge(edge) {
  edges.update(edgeToEdge(edge));
}

// eslint-disable-next-line
function addJobsToWorkflow(jobs) {
  if (!workflow) {
    alertify.notify(
      `You must create a workflow in the
    'Workflow management' page first.`,
      "error",
      5
    );
  } else {
    jobs = $("#jobs").length
      ? $("#jobs")
          .val()
          .join("-")
      : jobs;
    call(`/add_jobs_to_workflow/${workflow.id}/${jobs}`, function(result) {
      workflow.last_modified = result.update_time;
      result.jobs.forEach((job, index) => {
        $("#add_jobs").remove();
        if (graph.findNode(job.id).length == 0) {
          nodes.add(jobToNode(job, index));
          workflow.jobs.push(job);
          alertify.notify(
            `Job '${job.name}' added to the workflow.`,
            "success",
            5
          );
        } else {
          alertify.notify(
            `${job.type} '${job.name}' already in workflow.`,
            "error",
            5
          );
        }
      });
    });
  }
}

function deleteNode(id) {
  workflow.jobs = workflow.jobs.filter((n) => n.id != id);
  call(`/delete_node/${workflow.id}/${id}`, function(result) {
    workflow.last_modified = result.update_time;
    alertify.notify(
      `'${result.job.name}' deleted from the workflow.`,
      "success",
      5
    );
  });
}

function deleteLabel(label) {
  nodes.remove(label.id);
  call(`/delete_label/${workflow.id}/${label.id}`, function(updateTime) {
    delete workflow.labels[label.id];
    workflow.last_modified = updateTime;
    alertify.notify("Label removed.", "success", 5);
  });
}

function saveEdge(edge) {
  const param = `${workflow.id}/${edge.subtype}/${edge.from}/${edge.to}`;
  call(`/add_edge/${param}`, function(result) {
    workflow.last_modified = result.update_time;
    edges.add(edgeToEdge(result.edge));
    graph.addEdgeMode();
  });
}

function deleteEdge(edgeId) {
  workflow.edges = workflow.edges.filter((e) => e.id != edgeId);
  call(`/delete_edge/${workflow.id}/${edgeId}`, (updateTime) => {
    workflow.last_modified = updateTime;
  });
}

function stopWorkflow() {
  call(`/stop_workflow/${currentRuntime}`, (result) => {
    if (!result) {
      alertify.notify("The workflow is not currently running", "error", 5);
    } else {
      alertify.notify(
        "Workflow will stop after current service...",
        "success",
        5
      );
    }
  });
}

function changeSkipValue(skip) {
  call(`/skip_jobs/${skip}/${graph.getSelectedNodes().join("-")}`, () => {
    alertify.notify(`Jobs ${skip}ped`, "success", 5);
  });
}

function formatJobTitle(job) {
  return `
    <b>Type</b>: ${job.type}<br>
    <b>Name</b>: ${job.name}
  `;
}

function jobToNode(job, index) {
  const defaultJob = ["Start", "End"].includes(job.name);
  return {
    id: job.id,
    shape: job.type == "Workflow" ? "ellipse" : defaultJob ? "circle" : "box",
    color: defaultJob ? "pink" : "#D2E5FF",
    label: job.type == "Workflow" ? `     ${job.name}     ` : job.name,
    name: job.name,
    type: job.type,
    title: formatJobTitle(job),
    x: job.positions[workflow.name]
      ? job.positions[workflow.name][0]
      : index
      ? index * 50 - 50
      : 0,
    y: job.positions[workflow.name]
      ? job.positions[workflow.name][1]
      : index
      ? index * 50 - 200
      : 0,
  };
}

function drawLabel(id, label) {
  nodes.add({
    id: id,
    shape: "box",
    type: "label",
    label: label.content,
    borderWidth: 0,
    color: "#FFFFFF",
    x: label.positions[0],
    y: label.positions[1],
  });
}

function drawIterationEdge(service) {
  if (!edges.get(-service.id)) {
    edges.add({
      id: -service.id,
      label: "Iteration",
      from: service.id,
      to: service.id,
      color: "black",
      arrows: { to: { enabled: true } },
    });
  }
}

function drawIterationService(service) {
  edges.add({
    id: -service.id,
    label: service.iterated_job,
    from: service.id,
    to: service.id,
    color: "black",
    arrows: { to: { enabled: true } },
  });
}

function edgeToEdge(edge) {
  return {
    id: edge.id,
    label: edge.label,
    type: edge.subtype,
    from: edge.source_id,
    to: edge.destination_id,
    smooth: {
      type: "curvedCW",
      roundness:
        edge.subtype == "success" ? 0.1 : edge.subtype == "failure" ? -0.1 : 0,
    },
    color: {
      color:
        edge.subtype == "success"
          ? "green"
          : edge.subtype == "failure"
          ? "red"
          : "blue",
    },
    arrows: { to: { enabled: true } },
  };
}

function deleteSelection() {
  const node = graph.getSelectedNodes()[0];
  if (node != 1 && node != 2) {
    if (node) deleteNode(node);
    graph.getSelectedEdges().map((edge) => deleteEdge(edge));
    graph.deleteSelected();
  } else {
    alertify.notify("Start and End cannot be deleted", "error", 5);
  }
}

function switchMode(mode) {
  if (["success", "failure", "prerequisite"].includes(mode)) {
    edgeType = mode;
    graph.addEdgeMode();
    alertify.notify(`Mode: creation of ${mode} edge.`, "success", 5);
  } else {
    graph.addNodeMode();
    alertify.notify("Mode: node motion.", "success", 5);
  }
  $(".dropdown-submenu a.menu-layer")
    .next("ul")
    .toggle();
}

$("#current-workflow").on("change", function() {
  $("#add_jobs").append(
    `<option value='${workflow.id}'>${workflow.name}</option>`
  );
  switchToWorkflow(this.value);
});

$("#current-runtimes").on("change", function() {
  getWorkflowState();
});

function savePositions() {
  $.ajax({
    type: "POST",
    url: `/save_positions/${workflow.id}`,
    dataType: "json",
    contentType: "application/json;charset=UTF-8",
    data: JSON.stringify(graph.getPositions(), null, "\t"),
    success: function(updateTime) {
      if (updateTime) {
        workflow.last_modified = updateTime;
      } else {
        alertify.notify("HTTP Error 403 – Forbidden", "error", 5);
      }
    },
  });
}

Object.assign(action, {
  Edit: (job) => showTypePanel(job.type, job.id),
  Run: (job) => normalRun(job.id),
  "Run with Updates": (job) => showTypePanel(job.type, job.id, "run"),
  "Run Workflow": () => runWorkflow(),
  "Run Workflow with Updates": () => runWorkflow(true),
  Results: (job) => showResultsPanel(job.id, job.label, "service"),
  "Create Workflow": () => showTypePanel("workflow"),
  "Edit Workflow": () => showTypePanel("workflow", workflow.id),
  "Restart Workflow from Here": (job) =>
    showRestartWorkflowPanel(workflow, job),
  "Workflow Results": () =>
    showResultsPanel(workflow.id, workflow.name, "workflow"),
  "Workflow Logs": () => showLogsPanel(workflow),
  "Add to Workflow": () => showPanel("add_jobs"),
  "Stop Workflow": () => stopWorkflow(),
  "Remove from Workflow": deleteSelection,
  "Create 'Success' edge": () => switchMode("success"),
  "Create 'Failure' edge": () => switchMode("failure"),
  "Create 'Prerequisite' edge": () => switchMode("prerequisite"),
  "Move Nodes": () => switchMode("node"),
  "Create Label": () => showPanel("workflow_label"),
  "Edit Label": editLabel,
  "Edit Edge": (edge) => {
    showTypePanel("WorkflowEdge", edge.id);
  },
  "Delete Label": deleteLabel,
});

// eslint-disable-next-line
function createLabel() {
  const params = `${workflow.id}/${mousePosition.x}/${mousePosition.y}`;
  fCall(`/create_label/${params}`, `#workflow_label-form`, function(result) {
    if (currLabel) {
      deleteLabel(currLabel);
      currLabel = null;
    }
    $("#workflow_label").remove();
    drawLabel(result.id, result);
    alertify.notify("Label created.", "success", 5);
  });
}

function editLabel(label) {
  showPanel("workflow_label", null, () => {
    $("#content").val(label.label);
    currLabel = label;
  });
}

$("#network").contextMenu({
  menuSelector: "#contextMenu",
  menuSelected: function(invokedOn, selectedMenu) {
    const row = selectedMenu.text();
    action[row](selectedObject);
  },
});

function runWorkflow(withUpdates) {
  emptyProgressBar();
  workflow.jobs.forEach((job) => colorJob(job.id, "#D2E5FF"));
  if (withUpdates) {
    showTypePanel("Workflow", workflow.id, "run");
  } else {
    normalRun(workflow.id);
  }
}

function showRestartWorkflowPanel(workflow, job) {
  createPanel(
    "restart_workflow",
    `Restart Workflow '${workflow.name}' from '${job.name}'`,
    workflow.id,
    function() {
      $("#start_jobs").val(job.id);
      $("#start_jobs").selectpicker("refresh");
      workflowRunMode(workflow, true);
    }
  );
}

// eslint-disable-next-line
function restartWorkflow() {
  fCall(`/run_job/${workflow.id}`, `#restart_workflow-form`, function(result) {
    $(`#restart_workflow-${workflow.id}`).remove();
    runLogic(result);
  });
}

function colorJob(id, color) {
  if (id != 1 && id != 2) nodes.update({ id: id, color: color });
}

// eslint-disable-next-line
function getJobState(id) {
  call(`/get/service/${id}`, function(service) {
    if (service.status == "Running") {
      colorJob(id, "#89CFF0");
      $("#status").text("Status: Running.");
      $("#current-job").text(`Current job: ${service.name}.`);
      setTimeout(() => getJobState(id), 1500);
    } else {
      $("#status").text("Status: Idle.");
      $("#current-job").empty();
      colorJob(id, service.color);
    }
  });
}

function emptyProgressBar() {
  $("#progress-success,#progress-failure").width("0%");
  $("#progress-success-span,#progress-failure-span").empty();
}

// eslint-disable-next-line
function displayWorkflowState(result) {
  resetDisplay();
  if (result.state) {
    if (Object.entries(result.state.progress).length === 0) {
      emptyProgressBar();
    } else {
      $("#progressbar").show();
      $("#progress-success").width(
        `${(result.state.progress.passed * 100) / result.state.progress_max}%`
      );
      $("#progress-failure").width(
        `${(result.state.progress.failed * 100) / result.state.progress_max}%`
      );
      $("#progress-success-span").text(result.state.progress.passed);
      $("#progress-failure-span").text(result.state.progress.failed);
    }
    $("#status").text(`Status: ${result.state.status}`);
    const currJob = result.state.current_job;
    if (currJob) {
      colorJob(currJob.id, "#89CFF0");
      $("#current-job").text(`Current job: ${result.state.current_job.name}.`);
    } else {
      $("#current-job").empty();
    }
    if (result.state.jobs) {
      $.each(result.state.jobs, (id, state) => {
        const color = {
          true: "#32cd32",
          false: "#FF6666",
          skipped: "#D3D3D3",
        };
        if (id in nodes._data) {
          colorJob(id, color[state.success]);
          if (state.type != "Workflow" && state.number_of_targets) {
            let progress = `${state.completed}/${state.number_of_targets}`;
            if (state.failed > 0) progress += ` (${state.failed} failed)`;
            nodes.update({
              id: id,
              label: `${nodes.get(id).name}\n${progress}`,
            });
          }
        }
      });
    }
    if (result.state.edges) {
      $.each(result.state.edges, (id, devices) => {
        const label = devices == 1 ? "DEVICE" : "DEVICES";
        edges.update({
          id: id,
          label: `<b>${devices} ${label}</b>`,
          font: { size: 15, multi: "html" },
        });
      });
    }
  }
}

function resetDisplay() {
  $("#progressbar").hide();
  workflow.jobs.forEach((job) => {
    colorJob(job.id, job.skip ? "#D3D3D3" : "#D2E5FF");
  });
  workflow.edges.forEach((edge) => {
    edges.update({ id: edge.id, label: edge.label });
  });
}

function getWorkflowState(periodic) {
  const runtime = $("#current-runtimes").val();
  const url = runtime ? `/${runtime}` : "";
  if (userIsActive && workflow && workflow.id) {
    call(`/get_workflow_state/${workflow.id}${url}`, function(result) {
      if (result.workflow.id != workflow.id) return;
      currentRuntime = result.runtime;
      if (result.workflow.last_modified !== workflow.last_modified) {
        displayWorkflow(result);
      } else {
        displayWorkflowState(result);
      }
    });
  }
  if (periodic) setTimeout(() => getWorkflowState(true), 4000);
}

(function() {
  $("#left-arrow").bind("click", function() {
    switchToWorkflow(arrowHistory[arrowPointer - 1], "left");
  });
  $("#right-arrow").bind("click", function() {
    switchToWorkflow(arrowHistory[arrowPointer + 1], "right");
  });
  call("/get_all/workflow", function(workflows) {
    workflows.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < workflows.length; i++) {
      $("#current-workflow").append(
        `<option value="${workflows[i].id}">${workflows[i].name}</option>`
      );
    }
    if (workflow) {
      $("#current-workflow").val(workflow.id);
      switchToWorkflow(workflow.id);
    } else {
      workflow = $("#current-workflow").val();
      if (workflow) {
        switchToWorkflow(workflow);
      } else {
        alertify.notify(
          `You must create a workflow in the
        'Workflow management' page first.`,
          "error",
          5
        );
      }
    }
    $("#current-workflow,#current-runtimes").selectpicker({
      liveSearch: true,
    });
    getWorkflowState(true);
  });
})();
