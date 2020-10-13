from sqlalchemy import Boolean, ForeignKey, Integer
from flask_wtf import FlaskForm
from wtforms.widgets import TextArea
from wtforms import FormField
from wtforms.validators import (
    InputRequired,
    IPAddress,
    Length,
    MacAddress,
    NoneOf,
    NumberRange,
    Regexp,
    URL,
    ValidationError,
    Optional
)

from eNMS.database import db
from eNMS.forms.fields import HiddenField, SelectField, StringField, IntegerField, FieldList
from eNMS.forms.automation import NapalmForm
from eNMS.models.automation import ConnectionService


class VlanConfigurationService(ConnectionService):
    __tablename__ = "vlan_configuration_service"
    pretty_name = "Vlan Configuration"
    parent_type = "connection_service"
    id = db.Column(Integer, ForeignKey("connection_service.id"), primary_key=True)
    action = db.Column(db.SmallString)
    interface_name = db.Column(db.SmallString)
    vlan_id = db.Column(Integer)
    vrf = db.Column(db.SmallString)
    qos = db.Column(db.SmallString)
    ipv4s = db.Column(db.List)
    ipv6s = db.Column(db.List)
    shutdown = db.Column(db.SmallString)
    driver = db.Column(db.SmallString)
    use_device_driver = db.Column(Boolean, default=True)
    timeout = db.Column(Integer, default=60)
    optional_args = db.Column(db.Dict)

    __mapper_args__ = {"polymorphic_identity": "vlan_configuration_service"}

    def job(self, run, payload, device):
        napalm_connection = run.napalm_connection(device)
        config = [
            f"interface {run.interface_name}.{run.vlan_id}",
            f"encapsulation dot1q {run.vlan_id}"
        ]
        if run.description:
            config.append(f"description {run.description}")
        if run.vrf:
            config.append(f"vrf {run.vrf}")
        if run.qos:
            config.append(f"service-policy output {run.qos}m")
            # config.append(f"service-policy input {run.qos}m")
        is_secondary = False
        for ipv4 in run.ipv4s:
            if ipv4['ipv4_address']:
                if not is_secondary:
                    config.append(f"ipv4 address {ipv4['ipv4_address']} {ipv4['mask']}")
                    is_secondary = True
                else:
                    config.append(f"ipv4 address {ipv4['ipv4_address']} {ipv4['mask']} secondary")
        for ipv6 in run.ipv6s:
            pass
        config = "\n".join(config)
        run.log("info", "Pushing VLAN configuration with Napalm", device)
        run.napalm_commit(napalm_connection, device, config, run.action)
        return {"success": True, "result": f"Config push ({config})"}


class Ipv4Form(FlaskForm):
    ipv4_address = StringField(
        "IPv4 address",
        [
            Optional(),
            IPAddress(
                ipv4=True,
                message="Please enter an IPv4 address for the IPv4 address field",
            )
        ],
    )
    mask = SelectField(
        choices=(
            ("255.0.0.0", "8"),
            ("255.128.0.0", "9"),
            ("255.192.0.0", "10"),
            ("255.224.0.0", "11"),
            ("255.240.0.0", "12"),
            ("255.248.0.0", "13"),
            ("255.252.0.0", "14"),
            ("255.254.0.0", "15"),
            ("255.255.0.0", "16"),
            ("255.255.128.0", "17"),
            ("255.255.192.0", "18"),
            ("255.255.224.0", "19"),
            ("255.255.240.0", "20"),
            ("255.255.248.0", "21"),
            ("255.255.252.0", "22"),
            ("255.255.254.0", "23"),
            ("255.255.255.0", "24"),
            ("255.255.255.128", "25"),
            ("255.255.255.192", "26"),
            ("255.255.255.224", "27"),
            ("255.255.255.240", "28"),
            ("255.255.255.248", "29"),
            ("255.255.255.252", "30"),
            ("255.255.255.254", "31"),
        ),
        default="255.255.255.0"
    )


class Ipv6Form(FlaskForm):
    ipv6_address = StringField(
        "IPv6 address",
        [
            Optional(),
            IPAddress(
                ipv4=False,
                ipv6=True,
                message="Please enter an IPv6 address for the IPv6 address field",
            )
        ],
    )
    mask = StringField()


class VlanConfigurationForm(NapalmForm):
    form_type = HiddenField(default="vlan_configuration_service")
    action = SelectField(
        choices=(
            ("load_merge_candidate", "Load merge"),
            ("load_replace_candidate", "Load replace"),
        )
    )
    interface_name = StringField(validators=[InputRequired()])
    vlan_id = IntegerField(validators=[NumberRange(min=10, max=4000)])
    description = StringField()
    vrf = StringField()
    qos = StringField()
    ipv4s = FieldList(FormField(Ipv4Form), min_entries=5)
    ipv6s = FieldList(FormField(Ipv6Form), min_entries=5)
    shutdown = SelectField(
        choices=(
            ("yes", "yes"),
            ("no", "no"),
        ),
        default="no"
    )
    groups = {
        "Main Parameters": {
            "commands": [
                "action",
                "interface_name",
                "vlan_id",
                "description",
                "vrf",
                "qos",
                "shutdown"
            ], "default": "expanded"
        },
        "IPv4 address": {
            "commands": ["ipv4s"],
            "default": "expanded",
        },
        "IPv6 address": {
            "commands": ["ipv6s"],
            "default": "expanded",
        },
        **NapalmForm.groups,
    }
