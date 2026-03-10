IMAGE_NAME ?= portfolio-comparator
IMAGE_TAG  ?= latest
REGISTRY   ?= # e.g. ghcr.io/username, docker.io/username, 123456789.dkr.ecr.us-east-1.amazonaws.com

FULL_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(IMAGE_TAG)

.PHONY: build push release

build:
	docker build -t $(FULL_IMAGE) .

push: build
	docker push $(FULL_IMAGE)

release: push
