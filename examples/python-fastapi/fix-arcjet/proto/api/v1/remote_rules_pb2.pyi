from google.api import annotations_pb2 as _annotations_pb2
from proto.decide.v1alpha1 import decide_pb2 as _decide_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CreateRemoteRuleRequestBody(_message.Message):
    __slots__ = ()
    RATE_LIMIT_FIELD_NUMBER: _ClassVar[int]
    SHIELD_FIELD_NUMBER: _ClassVar[int]
    BOT_V2_FIELD_NUMBER: _ClassVar[int]
    FILTER_FIELD_NUMBER: _ClassVar[int]
    rate_limit: _decide_pb2.RateLimitRule
    shield: _decide_pb2.ShieldRule
    bot_v2: _decide_pb2.BotV2Rule
    filter: _decide_pb2.FilterRule
    def __init__(self, rate_limit: _Optional[_Union[_decide_pb2.RateLimitRule, _Mapping]] = ..., shield: _Optional[_Union[_decide_pb2.ShieldRule, _Mapping]] = ..., bot_v2: _Optional[_Union[_decide_pb2.BotV2Rule, _Mapping]] = ..., filter: _Optional[_Union[_decide_pb2.FilterRule, _Mapping]] = ...) -> None: ...

class GetRemoteRuleResponse(_message.Message):
    __slots__ = ()
    RATE_LIMIT_FIELD_NUMBER: _ClassVar[int]
    SHIELD_FIELD_NUMBER: _ClassVar[int]
    BOT_V2_FIELD_NUMBER: _ClassVar[int]
    FILTER_FIELD_NUMBER: _ClassVar[int]
    rate_limit: _decide_pb2.RateLimitRule
    shield: _decide_pb2.ShieldRule
    bot_v2: _decide_pb2.BotV2Rule
    filter: _decide_pb2.FilterRule
    def __init__(self, rate_limit: _Optional[_Union[_decide_pb2.RateLimitRule, _Mapping]] = ..., shield: _Optional[_Union[_decide_pb2.ShieldRule, _Mapping]] = ..., bot_v2: _Optional[_Union[_decide_pb2.BotV2Rule, _Mapping]] = ..., filter: _Optional[_Union[_decide_pb2.FilterRule, _Mapping]] = ...) -> None: ...

class ListRemoteRuleResponseEntry(_message.Message):
    __slots__ = ()
    RATE_LIMIT_FIELD_NUMBER: _ClassVar[int]
    SHIELD_FIELD_NUMBER: _ClassVar[int]
    BOT_V2_FIELD_NUMBER: _ClassVar[int]
    FILTER_FIELD_NUMBER: _ClassVar[int]
    rate_limit: _decide_pb2.RateLimitRule
    shield: _decide_pb2.ShieldRule
    bot_v2: _decide_pb2.BotV2Rule
    filter: _decide_pb2.FilterRule
    def __init__(self, rate_limit: _Optional[_Union[_decide_pb2.RateLimitRule, _Mapping]] = ..., shield: _Optional[_Union[_decide_pb2.ShieldRule, _Mapping]] = ..., bot_v2: _Optional[_Union[_decide_pb2.BotV2Rule, _Mapping]] = ..., filter: _Optional[_Union[_decide_pb2.FilterRule, _Mapping]] = ...) -> None: ...

class UpdateRemoteRuleRequestBody(_message.Message):
    __slots__ = ()
    RATE_LIMIT_FIELD_NUMBER: _ClassVar[int]
    SHIELD_FIELD_NUMBER: _ClassVar[int]
    BOT_V2_FIELD_NUMBER: _ClassVar[int]
    FILTER_FIELD_NUMBER: _ClassVar[int]
    rate_limit: _decide_pb2.RateLimitRule
    shield: _decide_pb2.ShieldRule
    bot_v2: _decide_pb2.BotV2Rule
    filter: _decide_pb2.FilterRule
    def __init__(self, rate_limit: _Optional[_Union[_decide_pb2.RateLimitRule, _Mapping]] = ..., shield: _Optional[_Union[_decide_pb2.ShieldRule, _Mapping]] = ..., bot_v2: _Optional[_Union[_decide_pb2.BotV2Rule, _Mapping]] = ..., filter: _Optional[_Union[_decide_pb2.FilterRule, _Mapping]] = ...) -> None: ...

class CreateRemoteRuleRequest(_message.Message):
    __slots__ = ()
    SITE_ID_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    site_id: str
    body: CreateRemoteRuleRequestBody
    def __init__(self, site_id: _Optional[str] = ..., body: _Optional[_Union[CreateRemoteRuleRequestBody, _Mapping]] = ...) -> None: ...

class CreateRemoteRuleResponse(_message.Message):
    __slots__ = ()
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class GetRemoteRuleRequest(_message.Message):
    __slots__ = ()
    SITE_ID_FIELD_NUMBER: _ClassVar[int]
    RULE_ID_FIELD_NUMBER: _ClassVar[int]
    site_id: str
    rule_id: str
    def __init__(self, site_id: _Optional[str] = ..., rule_id: _Optional[str] = ...) -> None: ...

class ListRemoteRulesRequest(_message.Message):
    __slots__ = ()
    SITE_ID_FIELD_NUMBER: _ClassVar[int]
    site_id: str
    def __init__(self, site_id: _Optional[str] = ...) -> None: ...

class ListRemoteRulesResponse(_message.Message):
    __slots__ = ()
    class RulesEntry(_message.Message):
        __slots__ = ()
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: ListRemoteRuleResponseEntry
        def __init__(self, key: _Optional[str] = ..., value: _Optional[_Union[ListRemoteRuleResponseEntry, _Mapping]] = ...) -> None: ...
    RULES_FIELD_NUMBER: _ClassVar[int]
    rules: _containers.MessageMap[str, ListRemoteRuleResponseEntry]
    def __init__(self, rules: _Optional[_Mapping[str, ListRemoteRuleResponseEntry]] = ...) -> None: ...

class UpdateRemoteRuleRequest(_message.Message):
    __slots__ = ()
    SITE_ID_FIELD_NUMBER: _ClassVar[int]
    RULE_ID_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    site_id: str
    rule_id: str
    body: UpdateRemoteRuleRequestBody
    def __init__(self, site_id: _Optional[str] = ..., rule_id: _Optional[str] = ..., body: _Optional[_Union[UpdateRemoteRuleRequestBody, _Mapping]] = ...) -> None: ...

class UpdateRemoteRuleResponse(_message.Message):
    __slots__ = ()
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class DeleteRemoteRuleRequest(_message.Message):
    __slots__ = ()
    SITE_ID_FIELD_NUMBER: _ClassVar[int]
    RULE_ID_FIELD_NUMBER: _ClassVar[int]
    site_id: str
    rule_id: str
    def __init__(self, site_id: _Optional[str] = ..., rule_id: _Optional[str] = ...) -> None: ...

class DeleteRemoteRuleResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
