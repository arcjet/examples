import logging
from flask import Flask

from .routes.attack import blueprint as attack_blueprint
from .routes.bots import blueprint as bots_blueprint
from .routes.rate_limiting import blueprint as rate_limiting_blueprint

app = Flask(__name__)

app.logger.setLevel(logging.DEBUG)

app.register_blueprint(attack_blueprint)
app.register_blueprint(bots_blueprint)
app.register_blueprint(rate_limiting_blueprint)

@app.route("/")
def index_route():
    return "Hello world. See the README for instructions."