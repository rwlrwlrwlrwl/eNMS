from wtforms.validators import InputRequired
from wtforms.widgets import TextArea

from eNMS import app
from eNMS.forms import BaseForm, set_custom_properties
from eNMS.forms.fields import (
    BooleanField,
    FloatField,
    HiddenField,
    IntegerField,
    StringField,
    DictField,
    MultipleInstanceField,
    PasswordField,
    SelectField,
)


@set_custom_properties
class ServiceForm(BaseForm):
    template = "service"
    form_type = HiddenField(default="service")
    id = HiddenField()
    name = StringField("Name")
    type = StringField("Service Type")
    shared = BooleanField("Shared Service")
    scoped_name = StringField("Scoped Name", [InputRequired()])
    description = StringField("Description")
    device_query = StringField(
        "Device Query", python=True, widget=TextArea(), render_kw={"rows": 2}
    )
    device_query_property = SelectField(
        "Query Property Type", choices=(("name", "Name"), ("ip_address", "IP address"))
    )
    devices = MultipleInstanceField("Devices")
    pools = MultipleInstanceField("Pools")
    update_pools = BooleanField("Update pools before running")
    workflows = MultipleInstanceField("Workflows")
    waiting_time = IntegerField(
        "Time to Wait before next service is started (in seconds)", default=0
    )
    send_notification = BooleanField("Send a notification")
    send_notification_method = SelectField(
        "Notification Method",
        choices=(("mail", "Mail"), ("slack", "Slack"), ("mattermost", "Mattermost")),
    )
    notification_header = StringField(widget=TextArea(), render_kw={"rows": 5})
    include_device_results = BooleanField("Include Device Results")
    include_link_in_summary = BooleanField("Include Result Link in Summary")
    display_only_failed_nodes = BooleanField("Display only Failed Devices")
    mail_recipient = StringField("Mail Recipients (separated by comma)")
    number_of_retries = IntegerField("Number of retries", default=0)
    time_between_retries = IntegerField("Time between retries (in seconds)", default=10)
    max_number_of_retries = IntegerField("Maximum number of retries", default=100)
    maximum_runs = IntegerField("Maximum number of runs", default=1)
    skip = BooleanField("Skip")
    skip_query = StringField(
        "Skip Query (Python)", python=True, widget=TextArea(), render_kw={"rows": 2}
    )
    skip_value = SelectField(
        "Skip Value", choices=(("True", "True"), ("False", "False"),),
    )
    vendor = StringField("Vendor")
    operating_system = StringField("Operating System")
    iteration_values = StringField("Iteration Values", python=True)
    initial_payload = DictField(help="common/initial_payload")
    iteration_variable_name = StringField(
        "Iteration Variable Name", default="iteration_value"
    )
    iteration_devices = StringField("Iteration Devices", python=True)
    iteration_devices_property = SelectField(
        "Iteration Devices Property",
        choices=(("name", "Name"), ("ip_address", "IP address")),
    )
    result_postprocessing = StringField(
        type="code", python=True, widget=TextArea(), render_kw={"rows": 8}
    )
    log_level = SelectField(
        "Logging",
        choices=((0, "Disable logging"), *enumerate(app.log_levels, 1)),
        default=1,
        validation=False,
    )
    multiprocessing = BooleanField("Multiprocessing")
    max_processes = IntegerField("Maximum number of processes", default=15)
    conversion_method = SelectField(
        choices=(
            ("none", "No conversion"),
            ("text", "Text"),
            ("json", "Json dictionary"),
            ("xml", "XML dictionary"),
        )
    )
    validation_method = SelectField(
        "Validation Method",
        choices=(
            ("none", "No validation"),
            ("text", "Validation by text match"),
            ("dict_included", "Validation by dictionary inclusion"),
            ("dict_equal", "Validation by dictionary equality"),
        ),
    )
    content_match = StringField(
        "Content Match", widget=TextArea(), render_kw={"rows": 8}, substitution=True
    )
    content_match_regex = BooleanField("Match content with Regular Expression")
    dict_match = DictField("Dictionary to Match Against", substitution=True)
    negative_logic = BooleanField("Negative logic")
    delete_spaces_before_matching = BooleanField("Delete Spaces before Matching")
    run_method = SelectField(
        "Run Method",
        choices=(
            ("per_device", "Run the service once per device"),
            ("once", "Run the service once"),
        ),
    )

    def validate(self):
        valid_form = super().validate()
        no_recipient_error = (
            self.send_notification.data
            and self.send_notification_method.data == "mail"
            and not self.mail_recipient.data
        )
        if no_recipient_error:
            self.mail_recipient.errors.append(
                "Please add at least one recipient for the mail notification."
            )
        conversion_validation_mismatch = (
            self.conversion_method.data == "text"
            and "dict" in self.validation_method.data
            or self.conversion_method.data in ("xml", "json")
            and "dict" not in self.validation_method.data
        )
        if conversion_validation_mismatch:
            self.conversion_method.errors.append(
                f"The conversion method is set to '{self.conversion_method.data}'"
                f" and the validation method to '{self.validation_method.data}' :"
                " these do not match."
            )
        return (
            valid_form and not no_recipient_error and not conversion_validation_mismatch
        )


class ConnectionForm(ServiceForm):
    form_type = HiddenField(default="connection")
    abstract_service = True
    credentials = SelectField(
        "Credentials",
        choices=(
            ("device", "Device Credentials"),
            ("user", "User Credentials"),
            ("custom", "Custom Credentials"),
        ),
    )
    custom_username = StringField("Custom Username", substitution=True)
    custom_password = PasswordField("Custom Password", substitution=True)
    start_new_connection = BooleanField("Start New Connection")
    close_connection = BooleanField("Close Connection")
    group = {
        "commands": [
            "credentials",
            "custom_username",
            "custom_password",
            "start_new_connection",
            "close_connection",
        ],
        "default": "expanded",
    }


class NetmikoForm(ConnectionForm):
    form_type = HiddenField(default="netmiko")
    abstract_service = True
    driver = SelectField(choices=app.NETMIKO_DRIVERS)
    use_device_driver = BooleanField(default=True)
    enable_mode = BooleanField(
        "Enable mode (run in enable mode or as root)", default=True
    )
    config_mode = BooleanField("Config mode", default=False)
    fast_cli = BooleanField()
    timeout = FloatField(default=10.0)
    delay_factor = FloatField(
        (
            "Delay Factor (Changing from default of 1"
            " will nullify Netmiko Timeout setting)"
        ),
        default=1.0,
    )
    global_delay_factor = FloatField(
        (
            "Global Delay Factor (Changing from default of 1"
            " will nullify Netmiko Timeout setting)"
        ),
        default=1.0,
    )
    groups = {
        "Netmiko Parameters": {
            "commands": [
                "driver",
                "use_device_driver",
                "enable_mode",
                "config_mode",
                "fast_cli",
                "timeout",
                "delay_factor",
                "global_delay_factor",
            ],
            "default": "expanded",
        },
        "Connection Parameters": ConnectionForm.group,
    }


class NapalmForm(ConnectionForm):
    form_type = HiddenField(default="napalm")
    abstract_service = True
    driver = SelectField(choices=app.NAPALM_DRIVERS)
    use_device_driver = BooleanField(default=True)
    timeout = IntegerField(default=10)
    optional_args = DictField()
    groups = {
        "Napalm Parameters": {
            "commands": ["driver", "use_device_driver", "timeout", "optional_args"],
            "default": "expanded",
        },
        "Connection Parameters": ConnectionForm.group,
    }


class RunForm(BaseForm):
    template = "object"
    form_type = HiddenField(default="run")
    id = HiddenField()


class RestartWorkflowForm(BaseForm):
    action = "eNMS.workflow.restartWorkflow"
    form_type = HiddenField(default="restart_workflow")
    start_services = MultipleInstanceField("Services", model="service")
    restart_runtime = SelectField("Restart Runtime", choices=(), validation=False)
    restart_from_top_level_workflow = BooleanField(default=True)


class FileForm(BaseForm):
    template = "file"
    form_type = HiddenField(default="file")
    file_content = StringField(widget=TextArea(), render_kw={"rows": 8})


class AddServiceForm(BaseForm):
    form_type = HiddenField(default="add_services")
    template = "add_services"
    mode = SelectField(
        "Mode",
        choices=(
            ("deep", "Deep Copy (creates a duplicate from the service)"),
            ("shallow", "Shallow Copy (creates a reference to the service)"),
        ),
    )
    search = StringField()


class WorkflowLabelForm(BaseForm):
    form_type = HiddenField(default="workflow_label")
    action = "eNMS.workflow.createLabel"
    text = StringField(widget=TextArea(), render_kw={"rows": 15})
    alignment = SelectField(
        "Text Alignment",
        choices=(("left", "Left"), ("center", "Center"), ("right", "Right")),
    )


class WorkflowEdgeForm(BaseForm):
    template = "object"
    form_type = HiddenField(default="workflow_edge")
    id = HiddenField()
    label = StringField()
