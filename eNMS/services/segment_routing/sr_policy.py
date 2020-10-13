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


class SRPolicyService(ConnectionService):
    __tablename__ = "sr_policy_service"
    pretty_name = "SR Policy"
    parent_type = "connection_service"
    id = db.Column(Integer, ForeignKey("connection_service.id"), primary_key=True)
    headend = db.Column(db.SmallString)
    endpoint = db.Column(db.SmallString)
    endpoint_ipv4 = db.Column(db.SmallString)
    color = db.Column(db.SmallString)
    description = db.Column(db.SmallString)
    path_name = db.Column(db.SmallString)
    segment_list = db.Column(db.List)
    driver = db.Column(db.SmallString)
    use_device_driver = db.Column(Boolean, default=True)
    timeout = db.Column(Integer, default=60)
    optional_args = db.Column(db.Dict)

    __mapper_args__ = {"polymorphic_identity": "sr_policy_service"}

    def job(self, run, payload, device):
        napalm_connection = run.napalm_connection(device)
        color_config = [
            f"extcommunity-set opaque c{run.color}",
            run.color,
            f"end-set"
        ]
        route_policy_config = [
            "prefix-set match-all",
            "0.0.0.0/0 le 32",
            "end-set",
            f"route-policy rp{run.color}",
            "if destination in match-all then",
            f"set extcommunity color c{run.color}",
            "endif",
            "end-policy"
        ]
        segment_list_config = [
            "segment-routing",
            "traffic-eng",
            f"segment-list path{run.color}",
        ]
        index_i = 10
        for s in run.segment_list:
            segment_type = s["segment_type"]
            value = s["value"]
            if value:
                segment_list_config.append(f"index {index_i} {segment_type} {value}")
                index_i += 10
        policy_config = [
            "segment-routing",
            "traffic-eng",
            f"policy p{run.color}",
            f"color {run.color} end-point ipv4 {run.endpoint_ipv4}",
            "candidate-paths",
            "preference 80",
            f"explicit segment-list path{run.color}"
        ]
        config = color_config + route_policy_config + segment_list_config + policy_config
        config = "\n".join(str(v) for v in config)
        run.log("info", "Pushing SR Policy configuration with Napalm", device)
        run.napalm_commit(napalm_connection, device, config)
        return {"success": True, "result": f"Config push ({config})"}


class SegmentForm(FlaskForm):
    segment_type = SelectField(
        "Next Node Type",
        choices=(
            ("address ipv4", "Specify hop address"),
            ("mpls label", "MPLS configuration"),
        ),
        default="address"
    )
    value = StringField()


class SRPolicyForm(NapalmForm):
    form_type = HiddenField(default="sr_policy_service")
    headend = SelectField(
        choices=(
            ("pe01", "pe01"),
            ("pe02", "pe02"),
            ("pe03", "pe03"),
            ("pe04", "pe04"),
            ("p11", "p11"),
            ("p12", "p12"),
        ),
        default="pe01"
    )
    endpoint = SelectField(
        choices=(
            ("pe01", "pe01"),
            ("pe02", "pe02"),
            ("pe03", "pe03"),
            ("pe04", "pe04"),
            ("p11", "p11"),
            ("p12", "p12"),
        ),
        default="pe04"
    )
    endpoint_ipv4 = StringField(
        "end-point ipv4",
        [
            IPAddress(
                ipv4=True,
                message="Please enter an end-point ipv4 address for the endpoint_ipv4 field",
            )
        ],
    )
    color = IntegerField(validators=[NumberRange(min=1, max=4294967295)])
    description = StringField()

    path_name = StringField(validators=[InputRequired()])
    segment_list = FieldList(FormField(SegmentForm), min_entries=5)

    groups = {
        "Policy Details": {
            "commands": [
                "headend",
                "endpoint",
                "endpoint_ipv4",
                "color",
                "description"
            ], "default": "expanded"
        },
        "Policy Path": {
            "commands": ["path_name", "segment_list"],
            "default": "expanded",
        },
        **NapalmForm.groups,
    }
